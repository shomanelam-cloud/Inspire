import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env';

export interface AuthoritativePriceOptions {
  courseSlug?: string;
  packageSlug?: string;
  couponCode?: string;
  userId?: string | null;
  dbClient?: any;
  req?: any;
  env?: Record<string, any>;
}

export interface AuthoritativePriceResult {
  ok: boolean;
  basePrice: number;
  offerDiscount: number;
  couponDiscount: number;
  totalDiscount: number;
  finalAmount: number;
  itemTitle: string;
  itemId: string;
  isPackage: boolean;
  offerId: string | null;
  offerTitle: string | null;
  offer: any | null;
  couponId: string | null;
  couponCode: string | null;
  coupon: any | null;
  couponMessage: string | null;
  couponMessageRoman: string | null;
  error?: string;
  statusCode?: number;
}

export async function resolveAuthoritativePrice(
  options: AuthoritativePriceOptions
): Promise<AuthoritativePriceResult> {
  const { courseSlug, packageSlug, couponCode, userId, dbClient } = options;

  const emptyResult: AuthoritativePriceResult = {
    ok: false,
    basePrice: 0,
    offerDiscount: 0,
    couponDiscount: 0,
    totalDiscount: 0,
    finalAmount: 0,
    itemTitle: '',
    itemId: '',
    isPackage: false,
    offerId: null,
    offerTitle: null,
    offer: null,
    couponId: null,
    couponCode: null,
    coupon: null,
    couponMessage: null,
    couponMessageRoman: null,
  };

  const supabaseUrl = getEnv(options.req || options, 'SUPABASE_URL') || getEnv(options.req || options, 'VITE_SUPABASE_URL');
  const serviceKey = getEnv(options.req || options, 'SUPABASE_SERVICE_ROLE_KEY');

  if (!dbClient && (!supabaseUrl || !serviceKey)) {
    return {
      ...emptyResult,
      statusCode: 503,
      error: 'Database service unavailable. Pricing cannot be calculated.',
    };
  }

  const supabase = dbClient || createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });

  if (!courseSlug && !packageSlug) {
    return {
      ...emptyResult,
      statusCode: 400,
      error: 'Course or package selection is required.',
    };
  }

  let basePrice = 0;
  let itemTitle = '';
  let itemId = '';
  let isPackage = false;
  let itemSlug = '';

  // 1. Resolve Package or Course authoritatively from DB
  if (packageSlug && typeof packageSlug === 'string' && packageSlug.trim()) {
    const { data: pkg, error: pkgErr } = await supabase
      .from('packages')
      .select('id, title, price, is_active')
      .eq('slug', packageSlug.trim())
      .maybeSingle();

    if (pkgErr) {
      return {
        ...emptyResult,
        statusCode: 500,
        error: 'Failed to query package pricing from database.',
      };
    }

    if (!pkg) {
      return {
        ...emptyResult,
        statusCode: 400,
        error: 'Invalid or unknown package selected. Package record not found.',
      };
    }

    if (!pkg.is_active) {
      return {
        ...emptyResult,
        statusCode: 400,
        error: 'Selected package is inactive and no longer available.',
      };
    }

    if (pkg.price === null || pkg.price === undefined || pkg.price === '') {
      return {
        ...emptyResult,
        statusCode: 400,
        error: 'Package price is missing or invalid in database.',
      };
    }

    const pkgPrice = Number(pkg.price);
    if (isNaN(pkgPrice) || pkgPrice < 0 || !isFinite(pkgPrice)) {
      return {
        ...emptyResult,
        statusCode: 400,
        error: 'Invalid or unverifiable package price.',
      };
    }

    basePrice = pkgPrice;
    itemTitle = pkg.title;
    itemId = pkg.id;
    isPackage = true;
    itemSlug = packageSlug.trim();
  } else if (courseSlug && typeof courseSlug === 'string' && courseSlug.trim()) {
    const { data: crs, error: crsErr } = await supabase
      .from('courses')
      .select('id, title, price, status')
      .eq('slug', courseSlug.trim())
      .maybeSingle();

    if (crsErr) {
      return {
        ...emptyResult,
        statusCode: 500,
        error: 'Failed to query course pricing from database.',
      };
    }

    if (!crs) {
      return {
        ...emptyResult,
        statusCode: 400,
        error: 'Invalid or unknown course selected. Course record not found.',
      };
    }

    if (crs.status === 'archived') {
      return {
        ...emptyResult,
        statusCode: 400,
        error: 'Selected course is archived and no longer accepting enrollments.',
      };
    }

    if (crs.price === null || crs.price === undefined || crs.price === '') {
      return {
        ...emptyResult,
        statusCode: 400,
        error: 'Course price is missing or invalid in database.',
      };
    }

    const coursePrice = Number(crs.price);
    if (isNaN(coursePrice) || coursePrice < 0 || !isFinite(coursePrice)) {
      return {
        ...emptyResult,
        statusCode: 400,
        error: 'Invalid or unverifiable course price.',
      };
    }

    basePrice = coursePrice;
    itemTitle = crs.title;
    itemId = crs.id;
    isPackage = false;
    itemSlug = courseSlug.trim();
  } else {
    return {
      ...emptyResult,
      statusCode: 400,
      error: 'Valid course or package selection is required.',
    };
  }

  // 2. Query Active Promotional Offers
  const today = new Date().toISOString().split('T')[0];
  const { data: offers, error: offErr } = await supabase
    .from('offers')
    .select('*')
    .eq('is_active', true)
    .lte('start_date', today)
    .gte('end_date', today)
    .order('discount_percentage', { ascending: false });

  if (offErr) {
    return {
      ...emptyResult,
      statusCode: 500,
      error: 'Failed to query promotional offers from database.',
    };
  }

  let eligibleOffer: any = null;
  let offerDiscount = 0;
  let offerId: string | null = null;
  let offerTitle: string | null = null;

  if (offers && offers.length > 0) {
    for (const off of offers) {
      if (
        !off.applicable_course_slugs ||
        off.applicable_course_slugs.length === 0 ||
        off.applicable_course_slugs.includes(itemSlug)
      ) {
        const discPct = Number(off.discount_percentage);
        if (!isNaN(discPct) && discPct > 0 && discPct <= 100 && isFinite(discPct)) {
          eligibleOffer = off;
          offerId = off.id;
          offerTitle = off.title;
          offerDiscount = Math.round((basePrice * discPct) / 100);
          offerDiscount = Math.min(basePrice, Math.max(0, offerDiscount));
          break;
        }
      }
    }
  }

  const runningTotal = Math.max(0, basePrice - offerDiscount);

  // 3. Validate Database-Backed Coupon (No demo or hardcoded fallbacks)
  let couponDiscount = 0;
  let validatedCoupon: any = null;
  let couponId: string | null = null;
  let resolvedCouponCode: string | null = null;
  let couponMessage: string | null = null;
  let couponMessageRoman: string | null = null;

  if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
    const cleanCode = couponCode.trim().toUpperCase();
    resolvedCouponCode = cleanCode;

    const { data: cp, error: cpErr } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle();

    if (cpErr) {
      return {
        ...emptyResult,
        statusCode: 500,
        error: 'Failed to verify coupon code in database.',
      };
    }

    if (!cp) {
      couponMessage = 'Coupon code is invalid or has expired.';
      couponMessageRoman = 'Yeh coupon code ghalat hai ya expire ho chuka hai.';
    } else if (!cp.is_active) {
      couponMessage = 'Coupon is inactive.';
      couponMessageRoman = 'Yeh coupon filhal ghair-faal hai.';
    } else if ((cp.start_date && today < cp.start_date) || (cp.end_date && today > cp.end_date)) {
      couponMessage = 'Coupon code is invalid or has expired.';
      couponMessageRoman = 'Yeh coupon code expire ho chuka hai.';
    } else if (cp.usage_limit && cp.times_used >= cp.usage_limit) {
      couponMessage = 'This coupon has reached its maximum global usage limit.';
      couponMessageRoman = 'Is coupon ki kul istamaal ki hadd mukammal ho chuki hai.';
    } else if (runningTotal < Number(cp.min_amount || 0)) {
      couponMessage = `Minimum order amount for this coupon is Rs. ${cp.min_amount}.`;
      couponMessageRoman = `Is coupon ke liye kam az kam Rs. ${cp.min_amount} ka order darkar hai.`;
    } else if (
      cp.applicable_course_slugs &&
      cp.applicable_course_slugs.length > 0 &&
      !cp.applicable_course_slugs.includes(itemSlug)
    ) {
      couponMessage = 'This coupon is not applicable to the selected course.';
      couponMessageRoman = 'Yeh coupon is intikhab shuda course par laagu nahi hota.';
    } else {
      // Check per-user redemption limit if user is authenticated
      let userAlreadyRedeemed = false;
      if (userId) {
        const { data: red, error: redErr } = await supabase
          .from('coupon_redemptions')
          .select('id')
          .eq('coupon_id', cp.id)
          .eq('user_id', userId)
          .maybeSingle();

        if (redErr) {
          return {
            ...emptyResult,
            statusCode: 500,
            error: 'Failed to verify coupon user redemption history.',
          };
        }

        if (red) {
          userAlreadyRedeemed = true;
        }
      }

      if (userAlreadyRedeemed) {
        couponMessage = 'You have already redeemed this coupon once.';
        couponMessageRoman = 'Aap pehle hi yeh coupon aik martaba istamaal kar chuke hain.';
      } else {
        const val = Number(cp.discount_value);
        if (isNaN(val) || val <= 0 || !isFinite(val)) {
          couponMessage = 'Invalid coupon discount value configured.';
          couponMessageRoman = 'Coupon discount value durust nahi hai.';
        } else {
          let calculatedDiscount = 0;
          let isValidType = false;

          if (cp.discount_type === 'percentage') {
            if (val > 100) {
              couponMessage = 'Invalid coupon percentage configured.';
              couponMessageRoman = 'Coupon percentage hadd se zyada hai.';
            } else {
              calculatedDiscount = Math.round((runningTotal * val) / 100);
              isValidType = true;
            }
          } else if (cp.discount_type === 'fixed') {
            calculatedDiscount = Math.min(runningTotal, val);
            isValidType = true;
          } else {
            couponMessage = 'Unsupported coupon discount type.';
          }

          if (isValidType) {
            calculatedDiscount = Math.min(runningTotal, Math.max(0, calculatedDiscount));
            couponDiscount = calculatedDiscount;
            validatedCoupon = cp;
            couponId = cp.id;
            couponMessage = `Coupon applied! You saved Rs. ${couponDiscount.toLocaleString()}.`;
            couponMessageRoman = `Coupon lag gaya! Aap ki Rs. ${couponDiscount.toLocaleString()} bachat hui.`;
          }
        }
      }
    }
  }

  // 4. Calculate Final Authoritative Totals
  const totalDiscount = Math.min(basePrice, offerDiscount + couponDiscount);
  const finalAmount = Math.max(0, basePrice - totalDiscount);

  if (isNaN(finalAmount) || finalAmount < 0 || !isFinite(finalAmount)) {
    return {
      ...emptyResult,
      statusCode: 500,
      error: 'Calculated final payment amount is invalid.',
    };
  }

  return {
    ok: true,
    basePrice,
    offerDiscount,
    couponDiscount,
    totalDiscount,
    finalAmount,
    itemTitle,
    itemId,
    isPackage,
    offerId,
    offerTitle,
    offer: eligibleOffer
      ? {
          id: eligibleOffer.id,
          title: eligibleOffer.title,
          titleRomanUrdu: eligibleOffer.title_roman_urdu,
          discountPercentage: eligibleOffer.discount_percentage,
          discountAmount: offerDiscount,
        }
      : null,
    couponId,
    couponCode: resolvedCouponCode,
    coupon: validatedCoupon
      ? {
          id: validatedCoupon.id,
          code: validatedCoupon.code,
          discountType: validatedCoupon.discount_type,
          discountValue: validatedCoupon.discount_value,
          discountAmount: couponDiscount,
        }
      : null,
    couponMessage,
    couponMessageRoman,
  };
}
