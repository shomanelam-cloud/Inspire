import { createClient } from '@supabase/supabase-js';
import { resolveAuthoritativePrice } from '../_lib/pricing';
import { getEnv } from '../_lib/env';

function normalizePakistaniPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('92') && digits.length === 12) {
    return '0' + digits.slice(2);
  }
  return digits;
}

function isValidPhone(phone: string): boolean {
  const normalized = normalizePakistaniPhone(phone);
  return /^03[0-9]{9}$/.test(normalized);
}

function generatePaymentRef(): string {
  const year = new Date().getFullYear();
  const randomPart = Math.floor(10000 + Math.random() * 90000);
  return `IBA-PAY-${year}-${randomPart}`;
}

function generateAdmissionRef(): string {
  const year = new Date().getFullYear();
  const randomPart = Math.floor(10000 + Math.random() * 90000);
  return `IBA-${year}-${randomPart}`;
}

export default async function handler(req: any, res: any, dbClient?: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const {
      fullName,
      email,
      phone,
      city,
      courseSlug,
      courseTitle,
      paymentMethod,
      transactionId,
      accountSenderName,
      accountSenderNumber,
      screenshotPath,
      couponCode,
      notes,
      userId,
    } = body;

    // 1. Basic Field Validations
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 3) {
      return res.status(400).json({ ok: false, error: 'Full name is required (at least 3 characters).' });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ ok: false, error: 'A valid email address is required.' });
    }

    if (!phone || typeof phone !== 'string' || !isValidPhone(phone)) {
      return res.status(400).json({ ok: false, error: 'A valid Pakistani mobile phone number is required (e.g. 0300-1234567).' });
    }

    if (!courseSlug || typeof courseSlug !== 'string' || !courseSlug.trim()) {
      return res.status(400).json({ ok: false, error: 'Course selection is required.' });
    }

    const validMethods = ['jazzcash', 'easypaisa', 'bank_transfer', 'other'];
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      return res.status(400).json({ ok: false, error: 'Please select a valid payment method (JazzCash, Easypaisa, Bank Transfer).' });
    }

    if (!transactionId || typeof transactionId !== 'string' || transactionId.trim().length < 4) {
      return res.status(400).json({ ok: false, error: 'Valid Transaction ID / TID is required.' });
    }

    const cleanTxId = transactionId.trim().toUpperCase();
    const normalizedPhone = normalizePakistaniPhone(phone);

    // 2. Setup Supabase Client (Fail safely if credentials unavailable)
    const supabaseUrl = getEnv(req, 'SUPABASE_URL') || getEnv(req, 'VITE_SUPABASE_URL');
    const serviceKey = getEnv(req, 'SUPABASE_SERVICE_ROLE_KEY');

    if (!dbClient && (!supabaseUrl || !serviceKey)) {
      return res.status(503).json({
        ok: false,
        error: 'Database service unavailable. Payment submission cannot be processed.',
      });
    }

    const supabase = dbClient || createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });

    // 3. User Identity Verification (Never blindly trust client-supplied userId)
    let verifiedUserId: string | null = null;
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (token) {
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userData?.user) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized: Invalid or expired session token.',
        });
      }
      verifiedUserId = userData.user.id;

      // Reject if client attempts to submit on behalf of a different userId
      if (userId && typeof userId === 'string' && userId.trim() !== verifiedUserId) {
        return res.status(403).json({
          ok: false,
          error: 'Forbidden: Cannot submit payment on behalf of another user account.',
        });
      }
    } else if (userId && typeof userId === 'string' && userId.trim().length > 0) {
      // Unauthenticated request attempting to claim a userId without session token
      return res.status(401).json({
        ok: false,
        error: 'Unauthorized: Authentication token required when associating payment with a user ID.',
      });
    }

    // 4. Duplicate Transaction ID Check (Safe Idempotency)
    const { data: existingTx, error: txCheckErr } = await supabase
      .from('online_payments')
      .select('id, reference_number')
      .eq('transaction_id', cleanTxId)
      .maybeSingle();

    if (txCheckErr) {
      return res.status(500).json({
        ok: false,
        error: 'Failed to verify transaction uniqueness.',
      });
    }

    if (existingTx) {
      return res.status(409).json({
        ok: false,
        error: 'Ye Transaction ID pehle use ho chuki hai. Please apni payment details verify karein.',
        duplicateTx: true,
      });
    }

    // 5. Authoritative Course Validation & Pricing (via shared helper)
    const priceResult = await resolveAuthoritativePrice({
      courseSlug,
      couponCode,
      userId: verifiedUserId,
      dbClient: supabase,
      req,
      env: req.env,
    });

    if (!priceResult.ok) {
      return res.status(priceResult.statusCode || 400).json({
        ok: false,
        error: priceResult.error,
      });
    }

    // If client supplied a coupon code, verify that it was successfully validated and accepted
    if (couponCode && typeof couponCode === 'string' && couponCode.trim() && !priceResult.couponId) {
      return res.status(400).json({
        ok: false,
        error: priceResult.couponMessage || 'Invalid, expired, or ineligible coupon code.',
      });
    }

    const courseId = priceResult.itemId;
    const authoritativeCourseTitle = priceResult.itemTitle || courseTitle || courseSlug;
    const basePrice = priceResult.basePrice;
    const discountAmount = priceResult.totalDiscount;
    const offerId = priceResult.offerId;
    const offerTitle = priceResult.offerTitle;
    const couponId = priceResult.couponId;
    const finalAmount = priceResult.finalAmount;

    // If client supplied an amount, verify it matches the authoritative finalAmount
    if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
      const suppliedAmount = Number(body.amount);
      if (isNaN(suppliedAmount) || suppliedAmount < 0) {
        return res.status(400).json({ ok: false, error: 'Invalid payment amount specified.' });
      }
      if (Math.abs(suppliedAmount - finalAmount) > 1) {
        return res.status(400).json({
          ok: false,
          error: `Payment amount mismatch: Expected Rs. ${finalAmount}, but received Rs. ${suppliedAmount}.`,
        });
      }
    }

    const admissionRef = generateAdmissionRef();
    const paymentRef = generatePaymentRef();

    // 6. Insert Admission Record (Must succeed with valid ID)
    const { data: adm, error: admErr } = await supabase
      .from('admissions')
      .insert({
        reference_number: admissionRef,
        admission_type: 'online',
        full_name: fullName.trim(),
        phone: normalizedPhone,
        email: email.trim().toLowerCase(),
        city: (city && city.trim()) || 'Online',
        course_slug: courseSlug,
        course_title: authoritativeCourseTitle,
        status: 'pending',
        notes: notes ? notes.trim() : null,
        user_id: verifiedUserId,
      })
      .select('id, reference_number')
      .single();

    if (admErr || !adm || !adm.id) {
      return res.status(500).json({
        ok: false,
        error: 'Failed to record admission in database.',
      });
    }

    const insertedAdmissionId = adm.id;

    // 7. Insert Online Payment Record (Must succeed with valid ID)
    const { data: pay, error: payErr } = await supabase
      .from('online_payments')
      .insert({
        reference_number: paymentRef,
        admission_id: insertedAdmissionId,
        user_id: verifiedUserId,
        course_id: courseId,
        course_slug: courseSlug,
        course_title: authoritativeCourseTitle,
        payment_method: paymentMethod,
        transaction_id: cleanTxId,
        account_sender_name: accountSenderName ? accountSenderName.trim() : null,
        account_sender_number: accountSenderNumber ? accountSenderNumber.trim() : null,
        screenshot_path: screenshotPath || null,
        base_price: basePrice,
        discount_amount: discountAmount,
        coupon_id: couponId,
        coupon_code: couponCode ? couponCode.trim().toUpperCase() : null,
        offer_id: offerId,
        offer_title: offerTitle,
        final_amount: finalAmount,
        payment_status: 'pending',
      })
      .select('id, reference_number')
      .single();

    if (payErr || !pay || !pay.id) {
      // Compensate: Delete the orphan admission record created in step 6
      try {
        await supabase.from('admissions').delete().eq('id', insertedAdmissionId);
      } catch (cleanupErr) {
        console.error('Failed to cleanup orphan admission on payment failure:', cleanupErr);
      }

      if (payErr?.code === '23505') {
        return res.status(409).json({
          ok: false,
          error: 'Ye Transaction ID pehle use ho chuki hai. Please apni payment details verify karein.',
          duplicateTx: true,
        });
      }
      return res.status(500).json({
        ok: false,
        error: 'Failed to record payment in database.',
      });
    }

    const insertedPaymentId = pay.id;

    if (!insertedAdmissionId || !insertedPaymentId) {
      return res.status(500).json({
        ok: false,
        error: 'Required record IDs missing after database insert.',
      });
    }

    // Record coupon redemption if coupon was applied and user is authenticated
    if (couponId && verifiedUserId) {
      try {
        await supabase.from('coupon_redemptions').insert({
          coupon_id: couponId,
          user_id: verifiedUserId,
          payment_reference: paymentRef,
        });
        await supabase.rpc('increment_coupon_usage', { cp_id: couponId });
      } catch (cErr) {
        console.warn('Coupon redemption logging warning:', cErr);
      }
    }

    // 8. Return Success Only After Records Are Confirmed Saved with Real IDs
    return res.status(200).json({
      ok: true,
      admissionReference: admissionRef,
      paymentReference: paymentRef,
      admissionId: insertedAdmissionId,
      paymentId: insertedPaymentId,
      finalAmount,
      basePrice,
      discountAmount,
      transactionId: cleanTxId,
      message: 'Aap ki registration aur payment record receive ho gaya hai. Verification ke baad course access activate hoga.',
    });
  } catch (error: any) {
    console.error('Submit payment unexpected error:', error?.message || 'Unknown error');
    return res.status(500).json({
      ok: false,
      error: 'Registration aur payment submit karne mein masla pesh aya. Connection check karein.',
    });
  }
}
