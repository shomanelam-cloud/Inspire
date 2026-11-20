import { createClient } from '@supabase/supabase-js';
import { authenticateStaff } from '../_lib/auth';
import { getEnv } from '../_lib/env';
import { provisionEnrollment } from '../_lib/enrollmentProvisioning';

export default async function handler(req: any, res: any, dbClient?: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed. Use POST.' });
  }

  try {
    // 1. Strict Authenticate caller & check permissions
    const authResult = await authenticateStaff(req, 'payments', dbClient);
    if (!authResult.authorized) {
      return res.status(authResult.statusCode || 401).json({ ok: false, error: authResult.error });
    }

    const actorId = authResult.actorId!;
    const actorRole = authResult.actorRole!;

    const supabaseUrl = getEnv(req, 'SUPABASE_URL') || getEnv(req, 'VITE_SUPABASE_URL');
    const serviceKey = getEnv(req, 'SUPABASE_SERVICE_ROLE_KEY');

    if (!dbClient && (!supabaseUrl || !serviceKey)) {
      return res.status(500).json({ ok: false, error: 'Database credentials not configured.' });
    }

    const supabase = dbClient || createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { paymentId, adminNotes } = body;

    if (!paymentId) {
      return res.status(400).json({ ok: false, error: 'Payment ID is required.' });
    }

    // 2. Fetch payment record
    const { data: payment, error: pErr } = await supabase
      .from('online_payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (pErr || !payment) {
      return res.status(404).json({ ok: false, error: 'Payment record not found.' });
    }

    // Resolve target student user ID and course ID (from payment or linked admission)
    let targetUserId = payment.user_id;
    let targetCourseId = payment.course_id;

    if ((!targetUserId || !targetCourseId) && payment.admission_id) {
      const { data: admission } = await supabase
        .from('admissions')
        .select('id, user_id, email, course_slug')
        .eq('id', payment.admission_id)
        .maybeSingle();

      if (admission) {
        if (!targetUserId) {
          if (admission.user_id) {
            targetUserId = admission.user_id;
          } else if (admission.email) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', admission.email.toLowerCase())
              .maybeSingle();
            if (prof) targetUserId = prof.id;
          }
        }

        if (!targetCourseId && admission.course_slug) {
          const { data: crs } = await supabase
            .from('courses')
            .select('id')
            .eq('slug', admission.course_slug)
            .maybeSingle();
          if (crs) targetCourseId = crs.id;
        }
      }
    }

    if (!targetCourseId && payment.course_slug) {
      const { data: crs } = await supabase
        .from('courses')
        .select('id')
        .eq('slug', payment.course_slug)
        .maybeSingle();
      if (crs) targetCourseId = crs.id;
    }

    // Handle Idempotency / Already Verified Payment
    if (payment.payment_status === 'verified') {
      let existingEnrollmentInfo: any = null;

      if (targetUserId && targetCourseId) {
        // Ensure enrollment is provisioned/active (idempotent call with mode: 'recheck')
        const provRes = await provisionEnrollment({
          supabase,
          userId: targetUserId,
          courseId: targetCourseId,
          paymentId: payment.id,
          actorId,
          actorRole,
          mode: 'recheck',
        });

        if (provRes.ok) {
          existingEnrollmentInfo = {
            studentCode: provRes.studentCode,
            expiryDate: provRes.expiryDate,
            id: provRes.enrollment?.id,
            status: provRes.enrollment?.status || provRes.status || 'active',
            ...(provRes.note ? { note: provRes.note } : {}),
          };
        }
      }

      // Record audit log for verification request
      if (actorId) {
        try {
          await supabase.from('audit_logs').insert({
            actor_id: actorId,
            actor_role: actorRole,
            action: 'verify_online_payment_idempotent',
            entity: 'online_payments',
            entity_id: paymentId,
            details: {
              transactionId: payment.transaction_id,
              amount: payment.final_amount,
              referenceNumber: payment.reference_number,
              alreadyVerified: true,
              studentCode: existingEnrollmentInfo?.studentCode,
              expiryDate: existingEnrollmentInfo?.expiryDate,
            },
          });
        } catch (_) {}
      }

      return res.status(200).json({
        ok: true,
        message: 'Payment was already verified.',
        payment,
        enrollment: existingEnrollmentInfo || {
          studentCode: null,
          expiryDate: null,
        },
      });
    }

    // 3. Update payment status to verified
    const nowIso = new Date().toISOString();
    const { data: updatedPayment, error: uErr } = await supabase
      .from('online_payments')
      .update({
        payment_status: 'verified',
        verified_by: actorId,
        verified_at: nowIso,
        rejection_reason: null,
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (uErr) {
      console.error('[Admin Verify Payment DB Error]', uErr?.code || 'DB_ERROR');
      return res.status(500).json({ ok: false, error: 'Failed to update payment status in database.' });
    }

    // 4. Provision enrollment in one step
    let enrollmentData: any = null;
    if (targetUserId && targetCourseId) {
      const provRes = await provisionEnrollment({
        supabase,
        userId: targetUserId,
        courseId: targetCourseId,
        paymentId: paymentId,
        actorId,
        actorRole,
        mode: 'initial',
      });

      if (!provRes.ok) {
        // Payment was marked verified, but provisioning failed: return clear error for admin retry
        console.error('[Admin Verify Payment Enrollment Provisioning Failed]', provRes.error);
        return res.status(500).json({
          ok: false,
          error: `Payment marked verified, but enrollment provisioning failed: ${provRes.error}. Please retry or check student profile.`,
          payment: updatedPayment,
          provisioningFailed: true,
        });
      }

      enrollmentData = {
        studentCode: provRes.studentCode,
        expiryDate: provRes.expiryDate,
        id: provRes.enrollment?.id,
        status: provRes.enrollment?.status || 'active',
      };
    }

    // 5. Update linked admission record if present
    if (payment.admission_id) {
      try {
        await supabase
          .from('admissions')
          .update({
            status: 'approved',
            reviewed_by: actorId,
            reviewed_at: nowIso,
            admin_notes: adminNotes || `Verified via payment ${payment.reference_number}.`,
          })
          .eq('id', payment.admission_id);
      } catch (_) {}
    }

    // 6. Create Audit Log
    if (actorId) {
      try {
        await supabase.from('audit_logs').insert({
          actor_id: actorId,
          actor_role: actorRole,
          action: 'verify_online_payment',
          entity: 'online_payments',
          entity_id: paymentId,
          details: {
            transactionId: payment.transaction_id,
            amount: payment.final_amount,
            referenceNumber: payment.reference_number,
            studentCode: enrollmentData?.studentCode,
            expiryDate: enrollmentData?.expiryDate,
            enrollmentId: enrollmentData?.id,
            notes: adminNotes || undefined,
          },
        });
      } catch (e: any) {
        console.warn('Audit log write error:', e);
      }
    }

    return res.status(200).json({
      ok: true,
      message: 'Payment verified and student enrollment activated.',
      payment: updatedPayment,
      enrollment: enrollmentData || {
        studentCode: null,
        expiryDate: null,
      },
    });
  } catch (err: any) {
    console.error('[Admin Verify Payment Exception]', err?.name || 'Exception', err?.message, err?.stack);
    return res.status(500).json({ ok: false, error: 'Internal server error while verifying payment.' });
  }
}
