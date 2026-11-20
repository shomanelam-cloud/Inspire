import React, { useState, useEffect } from 'react';
import { SEO } from '../../components/common/SEO';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Spinner } from '../../components/ui/Spinner';
import { useTranslation } from '../../i18n';
import { siteConfig } from '../../config/site';
import { OFFICIAL_COURSES } from '../../config/courses';
import { OFFICIAL_PAYMENT_METHODS, PaymentAccountDetails } from '../../config/paymentMethods';
import { PaymentService } from '../../services/paymentService';
import { compressPaymentProof } from '../../utils/imageCompressor';
import { useAuth } from '../../hooks/useAuth';
import {
  Laptop,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Award,
  Phone,
  CreditCard,
  BookOpen,
  ArrowLeft,
  AlertCircle,
  UserPlus,
  Eye,
  EyeOff,
  GraduationCap,
  Sparkles,
  Tag,
  Upload,
  Copy,
  Wallet,
  Smartphone,
  Building,
  HelpCircle,
  Send,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const OnlineJoinPage: React.FC = () => {
  const { language } = useTranslation();
  const isRoman = language === 'roman-urdu';
  const { signUp, user, profile } = useAuth();
  const navigate = useNavigate();

  // Basic Information States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notes, setNotes] = useState('');

  // Course / Package Selection
  const [selectedCourseSlug, setSelectedCourseSlug] = useState(OFFICIAL_COURSES[0]?.slug || 'youtube-monetization');

  // Coupon & Pricing States
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponFeedback, setCouponFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Authoritative Pricing State
  const [pricing, setPricing] = useState<{
    basePrice: number;
    totalDiscount: number;
    finalAmount: number;
    offer: any;
    coupon: any;
  }>({
    basePrice: 5000,
    totalDiscount: 0,
    finalAmount: 5000,
    offer: null,
    coupon: null,
  });
  const [calculatingPrice, setCalculatingPrice] = useState(false);

  // Payment States
  const [selectedMethod, setSelectedMethod] = useState<'jazzcash' | 'easypaisa' | 'bank_transfer'>('jazzcash');
  const [transactionId, setTransactionId] = useState('');
  const [accountSenderName, setAccountSenderName] = useState('');
  const [accountSenderNumber, setAccountSenderNumber] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedAdmissionRef, setSubmittedAdmissionRef] = useState<string | null>(null);
  const [submittedPaymentRef, setSubmittedPaymentRef] = useState<string | null>(null);
  const [submittedFinalAmount, setSubmittedFinalAmount] = useState<number>(5000);

  // Initialize fields if logged in
  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      if (profile?.fullName) setFullName(profile.fullName);
      if (profile?.phone) setPhone(profile.phone);
    }
  }, [user, profile]);

  // Recalculate price when course or coupon changes
  const updatePrice = async (cSlug: string, cCode?: string) => {
    try {
      setCalculatingPrice(true);
      const res = await PaymentService.calculateAuthoritativePrice(
        cSlug,
        undefined,
        cCode || couponCode,
        user?.id
      );

      setPricing({
        basePrice: res.basePrice,
        totalDiscount: res.totalDiscount,
        finalAmount: res.finalAmount,
        offer: res.offer,
        coupon: res.coupon,
      });

      if (cCode) {
        if (res.coupon) {
          setAppliedCoupon(res.coupon);
          setCouponFeedback({
            text: isRoman ? res.couponMessageRoman || 'Coupon kamiyabi se lag gaya!' : res.couponMessage || 'Coupon applied successfully!',
            isError: false,
          });
        } else {
          setAppliedCoupon(null);
          setCouponFeedback({
            text: isRoman ? res.couponMessageRoman || 'Yeh coupon code ghalat hai ya expire ho chuka hai.' : res.couponMessage || 'Invalid or expired coupon code.',
            isError: true,
          });
        }
      }
    } catch (e) {
      console.warn('Error fetching pricing:', e);
    } finally {
      setCalculatingPrice(false);
    }
  };

  useEffect(() => {
    updatePrice(selectedCourseSlug);
  }, [selectedCourseSlug]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setValidatingCoupon(true);
    setCouponFeedback(null);
    await updatePrice(selectedCourseSlug, couponCode.trim());
    setValidatingCoupon(false);
  };

  const handleRemoveCoupon = async () => {
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponFeedback(null);
    await updatePrice(selectedCourseSlug, '');
  };

  // Screenshot compression handler
  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage(
        isRoman
          ? 'Sirf tasveer (JPEG, PNG, WEBP) upload karein.'
          : 'Please upload an image file (JPEG, PNG, WEBP).'
      );
      return;
    }

    setScreenshotFile(file);
    setIsCompressing(true);
    try {
      const comp = await compressPaymentProof(file, 250 * 1024);
      setCompressedFile(comp.file);
      const originalKb = Math.round(comp.originalSizeBytes / 1024);
      const compressedKb = Math.round(comp.compressedSizeBytes / 1024);
      setCompressionInfo(
        isRoman
          ? `Size: ${originalKb} KB → ${compressedKb} KB (Under 250 KB limit)`
          : `Compressed: ${originalKb} KB → ${compressedKb} KB (Under 250 KB limit)`
      );
    } catch (err) {
      setCompressedFile(file);
      setCompressionInfo(`${Math.round(file.size / 1024)} KB`);
    } finally {
      setIsCompressing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const selectedMethodConfig = OFFICIAL_PAYMENT_METHODS.find((m) => m.id === selectedMethod) || OFFICIAL_PAYMENT_METHODS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!fullName.trim() || fullName.trim().length < 3) {
      setErrorMessage(isRoman ? 'Baraye meharbani apna mukammal naam darj karein.' : 'Please enter your full name.');
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage(isRoman ? 'Durust email address darj karein.' : 'Please enter a valid email address.');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 12) {
      setErrorMessage(
        isRoman
          ? 'Durust Pakistani mobile number darj karein (e.g. 0300-1234567).'
          : 'Please enter a valid Pakistani mobile number.'
      );
      return;
    }

    if (!transactionId.trim() || transactionId.trim().length < 4) {
      setErrorMessage(
        isRoman
          ? 'Baraye meharbani Transaction ID (TID / TRX ID) darj karein.'
          : 'Please enter the Transaction ID (TID / TRX ID) from your payment receipt.'
      );
      return;
    }

    // If not logged in, validate password for new account creation
    if (!user) {
      if (password.length < 8) {
        setErrorMessage(
          isRoman
            ? 'Password kam az kam 8 characters par mushtamil hona chahiye.'
            : 'Password must be at least 8 characters long.'
        );
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage(
          isRoman
            ? 'Dono passwords aapas mein match nahi kar rahe. Baraye meharbani check karein.'
            : 'Passwords do not match. Please re-enter.'
        );
        return;
      }
    }

    const chosenCourse = OFFICIAL_COURSES.find((c) => c.slug === selectedCourseSlug);
    const chosenCourseTitle = chosenCourse ? chosenCourse.title : selectedCourseSlug;

    try {
      setIsSubmitting(true);
      let createdUserId: string | null = user?.id || null;

      // Step 1: If not authenticated, create Supabase Auth account
      if (!user) {
        const signupRes = await signUp(
          {
            email: email.trim().toLowerCase(),
            password: password,
            fullName: fullName.trim(),
            phone: phone.trim(),
          },
          isRoman
        );

        if (!signupRes.success) {
          setErrorMessage(signupRes.error || 'Account creation mein masla pesh aya.');
          setIsSubmitting(false);
          return;
        }
      }

      // Step 2: Submit payment and admission via authoritative server API
      const fileToUpload = compressedFile || screenshotFile || undefined;

      const submitRes = await PaymentService.submitOnlinePayment({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        city: city.trim() || 'Online Student',
        courseSlug: selectedCourseSlug,
        courseTitle: chosenCourseTitle,
        paymentMethod: selectedMethod,
        transactionId: transactionId.trim().toUpperCase(),
        accountSenderName: accountSenderName.trim() || undefined,
        accountSenderNumber: accountSenderNumber.trim() || undefined,
        screenshotFile: fileToUpload,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        notes: notes.trim() || undefined,
        userId: createdUserId || undefined,
      });

      if (!submitRes.ok) {
        if (submitRes.duplicateTx) {
          setErrorMessage(
            isRoman
              ? 'Ye Transaction ID pehle use ho chuki hai. Please apni payment details verify karein.'
              : 'This Transaction ID has already been recorded. Please check your payment details.'
          );
        } else {
          setErrorMessage(submitRes.error || (isRoman ? 'Payment darj nahi ho saki. Helpline se rabta karein.' : 'Failed to record payment. Please contact helpline.'));
        }
      } else {
        setSubmittedAdmissionRef(submitRes.admissionReference || 'IBA-2026-REG');
        setSubmittedPaymentRef(submitRes.paymentReference || 'IBA-PAY-2026');
        setSubmittedFinalAmount(submitRes.finalAmount || pricing.finalAmount);
      }
    } catch (err: any) {
      setErrorMessage(
        isRoman
          ? 'Network ya server se rabta toot gaya. Connection check karein.'
          : 'Network error. Please verify your connection.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const courseOptions = OFFICIAL_COURSES.map((c) => ({
    value: c.slug,
    label: isRoman
      ? `${c.titleRomanUrdu} (Rs. ${c.price.toLocaleString()} / 6 Mah Access)`
      : `${c.title} (Rs. ${c.price.toLocaleString()} / 6-Month Access)`,
  }));

  return (
    <div className="w-full">
      <SEO
        title={isRoman ? 'Online Course Dakhla & Fees Payment' : 'Online Course Admission & Fee Payment'}
        description={
          isRoman
            ? 'The Inspire Business Academy online recorded programs mein dakhla, JazzCash, Easypaisa payment aur account activation.'
            : 'Enroll in online recorded programs with The Inspire Business Academy. Pay via JazzCash, Easypaisa, or Bank IBFT.'
        }
        canonicalPath="/join/online"
      />

      {/* Header */}
      <Section variant="light" spacing="md" className="border-b border-[#1F3FBF]/10">
        <Container size="md">
          <div className="mb-4 text-left">
            <Link to="/join" className="inline-flex items-center text-xs font-semibold text-[#1F3FBF] hover:underline">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {isRoman ? 'Dakhla Intikhab Par Wapis' : 'Back to Pathway Choice'}
            </Link>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-[#1F3FBF] text-xs font-bold mb-3">
                <Laptop className="w-3.5 h-3.5" />
                <span>{isRoman ? 'Online Recorded LMS Portal' : 'Online Recorded LMS Pathway'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black font-display text-[#0F1F5C] tracking-tight">
                {isRoman ? 'Online Course Dakhla & Fees Adaigi' : 'Online Admission & Payment'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
                {isRoman
                  ? 'Ghar bethay recorded video lectures, practical files, haftawar quizzes aur certificate. Fee ada karein aur registration mukammal karein.'
                  : 'Enroll in professional self-paced programs. Submit fee proof, receive admin verification, and start learning.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-500 block">{isRoman ? 'Course Muddat' : 'Duration'}</span>
                <span className="text-sm font-bold text-[#0F1F5C]">6 {isRoman ? 'Mah' : 'Months'} Access</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-500 block">{isRoman ? 'Final Exam Pass Mark' : 'Exam Pass Rule'}</span>
                <span className="text-sm font-bold text-emerald-700">70% Required</span>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Main Content Form */}
      <Section variant="light" spacing="lg">
        <Container size="md">
          {submittedAdmissionRef ? (
            /* SUCCESS PENDING BANNER */
            <Card elevated bordered className="p-8 text-center max-w-xl mx-auto border-2 border-emerald-500/30">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <h2 className="text-2xl font-bold font-display text-[#0F1F5C]">
                {isRoman ? 'Darkhwast & Payment Receive Ho Gayi!' : 'Admission & Payment Received!'}
              </h2>

              <p className="text-xs text-slate-600 mt-2 mb-6 leading-relaxed">
                {isRoman
                  ? 'Aap ki online registration aur fee payment proof kamiyabi se darj ho chuka hai. Academy administration payment verify karne ke baad aap ka student account activate kar degi.'
                  : 'Your application and fee transaction details have been submitted. Academy staff will verify your payment and activate your 6-month LMS access.'}
              </p>

              {/* Reference Numbers Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-6 space-y-2 text-left font-mono text-xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-sans">{isRoman ? 'Admission Ref No:' : 'Admission Ref:'}</span>
                  <span className="font-bold text-[#1F3FBF]">{submittedAdmissionRef}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-sans">{isRoman ? 'Payment Ref No:' : 'Payment Ref:'}</span>
                  <span className="font-bold text-emerald-700">{submittedPaymentRef}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{isRoman ? 'Ada Shuda Raqam:' : 'Amount Paid:'}</span>
                  <span className="font-bold text-[#0F1F5C]">Rs. {submittedFinalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Honest Pending Status Note */}
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed text-left flex items-start gap-2 mb-6">
                <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>{isRoman ? 'Ahem Wazahat (Pending State):' : 'Important Note (Pending Status):'}</strong>{' '}
                  {isRoman
                    ? 'Payment verification ke doran course lectures temporary locked rahenge. Tasdeeq hote hi aap ko portal par mukammal access mil jayega.'
                    : 'Course lectures remain temporarily locked while your payment is verified by academy staff.'}
                </div>
              </div>

              {/* WhatsApp Support Button */}
              <div className="space-y-3">
                <a
                  href={`https://wa.me/923093534289?text=${encodeURIComponent(
                    `Assalam o Alaikum! Meine Online Course Dakhla submit kiya hai. Mera Admission Ref: ${submittedAdmissionRef} aur Payment Ref: ${submittedPaymentRef} hai. Baraye meharbani payment verify farma dein.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="accent" fullWidth size="md" leftIcon={<Phone className="w-4 h-4" />}>
                    {isRoman ? 'WhatsApp Par Reference Confirm Karein' : 'Confirm on Academy WhatsApp'}
                  </Button>
                </a>

                <Link to="/student" className="block">
                  <Button variant="primary" fullWidth size="md" leftIcon={<GraduationCap className="w-4 h-4" />}>
                    {isRoman ? 'Student Portal Par Jayein' : 'Go to Student Portal'}
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            /* REGISTRATION & PAYMENT FORM */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Form Section (7 cols) */}
              <div className="lg:col-span-7">
                <Card elevated bordered className="p-6 bg-white border-slate-200">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {errorMessage && (
                      <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <p className="leading-relaxed font-medium">{errorMessage}</p>
                      </div>
                    )}

                    {/* Step 1: Course Selection */}
                    <div>
                      <h3 className="text-sm font-bold text-[#0F1F5C] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#1F3FBF] text-white text-[10px] flex items-center justify-center font-bold">
                          1
                        </span>
                        {isRoman ? 'Course Ka Intikhab' : 'Select Online Course'}
                      </h3>
                      <Select
                        label={isRoman ? 'Kis Course Mein Dakhla Lena Hai?' : 'Choose Program'}
                        options={courseOptions}
                        value={selectedCourseSlug}
                        onChange={(e) => setSelectedCourseSlug(e.target.value)}
                        required
                      />
                    </div>

                    {/* Step 2: Personal Information */}
                    <div>
                      <h3 className="text-sm font-bold text-[#0F1F5C] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#1F3FBF] text-white text-[10px] flex items-center justify-center font-bold">
                          2
                        </span>
                        {isRoman ? 'Aap Ki Maloomat & Login' : 'Personal Details & Account'}
                      </h3>

                      {user && (
                        <div className="p-3 mb-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-emerald-700" />
                            <span>Logged in as <strong>{profile?.fullName || user.email}</strong></span>
                          </div>
                          <Badge variant="secondary" size="sm">Active Account</Badge>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <Input
                          label={isRoman ? 'Mukammal Naam' : 'Full Name'}
                          placeholder="e.g. Muhammad Ali"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                        />
                        <Input
                          label={isRoman ? 'Mobile Phone' : 'Phone Number'}
                          placeholder="0300-1234567"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <Input
                          label={isRoman ? 'Email (Login Identity)' : 'Email (Login ID)'}
                          type="email"
                          placeholder="student@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={Boolean(user)}
                        />
                        <Input
                          label={isRoman ? 'Shehar / City' : 'City'}
                          placeholder="e.g. Sadiqabad / Lahore"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                        />
                      </div>

                      {/* Password creation only if not logged in */}
                      {!user && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <div className="relative">
                            <Input
                              label={isRoman ? 'Password (Min 8 chars)' : 'Password (Min 8 chars)'}
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-8.5 text-slate-400 hover:text-slate-600"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <Input
                            label={isRoman ? 'Confirm Password' : 'Confirm Password'}
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                          />
                        </div>
                      )}
                    </div>

                    {/* Step 3: Payment Details */}
                    <div>
                      <h3 className="text-sm font-bold text-[#0F1F5C] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#1F3FBF] text-white text-[10px] flex items-center justify-center font-bold">
                          3
                        </span>
                        {isRoman ? 'Fee Payment Ki Tafseelat' : 'Fee Payment Details'}
                      </h3>

                      {/* Payment Method Tabs */}
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        {isRoman ? 'Payment Method Muntakhib Karein' : 'Select Payment Method'}
                      </label>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {OFFICIAL_PAYMENT_METHODS.map((pm) => {
                          const isSelected = selectedMethod === pm.id;
                          return (
                            <button
                              key={pm.id}
                              type="button"
                              onClick={() => setSelectedMethod(pm.id)}
                              className={`p-2.5 rounded-xl border text-center transition-all ${
                                isSelected
                                  ? 'border-[#1F3FBF] bg-blue-50/70 text-[#0F1F5C] shadow-xs'
                                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                              }`}
                            >
                              <div className="flex justify-center mb-1 text-[#1F3FBF]">
                                {pm.id === 'jazzcash' && <Smartphone className="w-4 h-4 text-amber-600" />}
                                {pm.id === 'easypaisa' && <Wallet className="w-4 h-4 text-emerald-600" />}
                                {pm.id === 'bank_transfer' && <Building className="w-4 h-4 text-blue-600" />}
                              </div>
                              <span className="text-xs font-bold block">{pm.title.split(' ')[0]}</span>
                              <span className="text-[10px] text-slate-400 block">{pm.badge}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Selected Account Instructions Box */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-slate-700">{selectedMethodConfig.accountTitle}</span>
                          <span className="text-[11px] text-slate-400 font-mono">Official IBA Account</span>
                        </div>
                        <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 mb-2">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {selectedMethodConfig.accountNumber}
                          </span>
                          {selectedMethodConfig.accountNumber.includes('0309') && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard('03093534289')}
                              className="inline-flex items-center gap-1 text-[11px] text-[#1F3FBF] hover:underline font-semibold"
                            >
                              <Copy className="w-3 h-3" />
                              Copy
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {isRoman ? selectedMethodConfig.instructionsRomanUrdu : selectedMethodConfig.instructions}
                        </p>
                      </div>

                      {/* Transaction ID & Sender Name */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <Input
                            label={isRoman ? 'Transaction ID / TID (Zaroori)' : 'Transaction ID / TID (Required)'}
                            placeholder="e.g. 123456789012"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            required
                          />
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            {isRoman ? 'SMS ya app receipt se 12-digit TID note karein.' : '12-digit TID from SMS or App receipt.'}
                          </span>
                        </div>

                        <div>
                          <Input
                            label={isRoman ? 'Sender Ka Naam / Number' : 'Sender Name / Number (Optional)'}
                            placeholder="e.g. Ali Ahmed / 0300-..."
                            value={accountSenderName}
                            onChange={(e) => setAccountSenderName(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Payment Proof Upload with Compression */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {isRoman ? 'Payment Screenshot / Rasid Proof (Ikhtiyari / Recommended)' : 'Payment Receipt Screenshot (Recommended)'}
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-300 hover:border-[#1F3FBF] bg-slate-50/50 hover:bg-slate-50 transition-colors text-xs text-slate-600">
                            <Upload className="w-4 h-4 text-slate-400" />
                            <span>
                              {screenshotFile
                                ? screenshotFile.name
                                : isRoman
                                ? 'Screenshot muntakhib karein (JPG / PNG)'
                                : 'Select Screenshot (JPG / PNG)'}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleScreenshotChange}
                              className="hidden"
                            />
                          </label>
                        </div>
                        {compressionInfo && (
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{compressionInfo}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      fullWidth
                      size="lg"
                      isLoading={isSubmitting || isCompressing}
                      leftIcon={<Send className="w-4 h-4" />}
                      className="bg-[#1F3FBF] hover:bg-[#0F1F5C] mt-2"
                    >
                      {isRoman
                        ? `Rs. ${pricing.finalAmount.toLocaleString()} Adaigi & Dakhla Submit Karein`
                        : `Submit Registration & Rs. ${pricing.finalAmount.toLocaleString()} Payment`}
                    </Button>

                    <p className="text-center text-[11px] text-slate-400">
                      {isRoman
                        ? 'Submit karne par aap ka record safe database mein darj hoga aur payment verify ki jayegi.'
                        : 'Your data is securely stored and transaction is validated before course activation.'}
                    </p>
                  </form>
                </Card>
              </div>

              {/* Order Summary & Pricing Breakdown (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Pricing Summary Card */}
                <Card elevated bordered className="p-5 bg-white border-slate-200">
                  <h3 className="text-sm font-bold text-[#0F1F5C] uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>{isRoman ? 'Fees Ka Khulasa' : 'Payment Summary'}</span>
                    <Badge variant="navy" size="sm">6 Months</Badge>
                  </h3>

                  <div className="space-y-2.5 text-xs text-slate-700 pb-3 border-b border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">{isRoman ? 'Course Base Fee:' : 'Base Course Fee:'}</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        Rs. {pricing.basePrice.toLocaleString()}
                      </span>
                    </div>

                    {pricing.offer && (
                      <div className="flex justify-between items-center text-emerald-700">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{pricing.offer.title} (-{pricing.offer.discountPercentage}%)</span>
                        </span>
                        <span className="font-semibold font-mono">
                          -Rs. {pricing.offer.discountAmount.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {pricing.coupon && (
                      <div className="flex justify-between items-center text-emerald-700">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" />
                          <span>Coupon ({pricing.coupon.code})</span>
                        </span>
                        <span className="font-semibold font-mono">
                          -Rs. {pricing.coupon.discountAmount.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Final Total */}
                  <div className="flex justify-between items-center pt-3 text-base font-bold text-[#0F1F5C]">
                    <span>{isRoman ? 'Kul Qabil-e-Ada Raqam:' : 'Net Payable Amount:'}</span>
                    <span className="text-xl text-[#1F3FBF] font-mono">
                      Rs. {pricing.finalAmount.toLocaleString()}
                    </span>
                  </div>

                  {/* Coupon Code Input */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {isRoman ? 'Discount Coupon Code (Optional)' : 'Have a Promo / Scholarship Coupon?'}
                    </label>

                    {appliedCoupon ? (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                        <div className="flex items-center gap-1.5 font-mono font-bold">
                          <Tag className="w-3.5 h-3.5" />
                          <span>{appliedCoupon.code}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          className="text-xs text-rose-600 hover:underline font-semibold"
                        >
                          {isRoman ? 'Hata Dein' : 'Remove'}
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleApplyCoupon} className="flex gap-2">
                        <input
                          type="text"
                          placeholder={isRoman ? 'Coupon code darj karein' : 'Enter coupon code'}
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          className="flex-1 text-xs px-2.5 py-1.5 uppercase font-mono rounded-lg border border-slate-200 focus:outline-none focus:border-[#1F3FBF]"
                        />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          isLoading={validatingCoupon}
                          className="text-xs py-1.5"
                        >
                          {isRoman ? 'Lagayein' : 'Apply'}
                        </Button>
                      </form>
                    )}

                    {couponFeedback && (
                      <p
                        className={`text-[11px] mt-1.5 ${
                          couponFeedback.isError ? 'text-rose-600' : 'text-emerald-700 font-medium'
                        }`}
                      >
                        {couponFeedback.text}
                      </p>
                    )}
                  </div>
                </Card>

                {/* Benefits / FAQ Checklist */}
                <Card elevated bordered className="p-5 bg-white border-slate-200 space-y-3 text-xs text-slate-700">
                  <h4 className="font-bold text-[#0F1F5C] text-xs uppercase tracking-wider mb-2">
                    {isRoman ? 'Dakhlay Ke Baad Kya Hoga?' : 'What Happens Next?'}
                  </h4>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>{isRoman ? '1. Fauran Verification:' : '1. Fast Verification:'}</strong>{' '}
                      {isRoman
                        ? 'Admin aap ki TID check karke payment verify karega.'
                        : 'Staff checks your TID and approves payment.'}
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>{isRoman ? '2. Student Code & Access:' : '2. Student ID Code:'}</strong>{' '}
                      {isRoman
                        ? 'Aap ko official Student ID (IBA-ONL-2026-...) allot hoga aur 6-mah access khul jaye ga.'
                        : 'Unique online code is assigned with 6-month video lecture access.'}
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>{isRoman ? '3. Certificate & Quizzes:' : '3. Exam & Certificate:'}</strong>{' '}
                      {isRoman
                        ? 'Lectures mukammal hone aur 70% exam pass karne par official verified certificate milega.'
                        : '70% pass mark earns an official verified certificate.'}
                    </span>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </Container>
      </Section>
    </div>
  );
};
