import React, { useState, useEffect } from 'react';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card';
import { useTranslation } from '../../i18n';
import { siteConfig } from '../../config/site';
import { CmsService } from '../../services/cmsService';
import { SiteSettingsPublic } from '../../types';
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Phone,
  Laptop,
  GraduationCap,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const HeroSection: React.FC = () => {
  const { language, t } = useTranslation();
  const isRoman = language === 'roman-urdu';

  const [settings, setSettings] = useState<SiteSettingsPublic | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const s = await CmsService.getSiteSettings();
        setSettings(s);
      } catch (err) {
        console.warn('Failed to load site settings in HeroSection:', err);
      }
    }
    loadSettings();
  }, []);

  const academyName = (settings?.academyName || siteConfig.name).toUpperCase();
  const monthlyFee = settings?.physicalMonthlyFee ?? siteConfig.physicalPackage.monthlyFee;
  const totalFee = settings?.physicalTotalFee ?? siteConfig.physicalPackage.totalPackage;
  const courseCount = settings?.physicalCourseCount ?? siteConfig.physicalPackage.courseCount;
  const workingDays = settings?.workingDaysText || siteConfig.physicalPackage.schedule;
  const heroPackageImage = settings?.heroPackageImageUrl;

  return (
    <Section variant="light" spacing="lg" className="border-b border-[#1F3FBF]/10 relative overflow-hidden">
      <Container size="lg">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Main Hero Copy (7 cols) */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2">
              <Badge variant="accent" size="md">
                <Sparkles className="w-3.5 h-3.5 text-[#0F1F5C]" />
                <span>{siteConfig.mission}</span>
              </Badge>
              <Badge variant="secondary" size="md">
                <span>Sadiqabad, Punjab</span>
              </Badge>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-display tracking-tight text-[#0F1F5C] leading-[1.12]">
              {academyName}
            </h1>

            <p className="text-base sm:text-lg font-bold text-[#1F3FBF]">
              {isRoman
                ? 'Hunarmand Baniye — Physical Academy Batches aur Online Recorded LMS'
                : 'Empowering Youth with Commercial Digital Skills & Online LMS'}
            </p>

            <p className="text-sm sm:text-base text-[#0F1F5C]/80 leading-relaxed max-w-2xl">
              {isRoman
                ? 'Sadiqabad campus par computer lab sahulat, haftawar practical tests, aur 10 ahem digital skills. Ghar baithe seekhne ke liye online recorded courses ba-asani dastiyab hain.'
                : 'Hands-on practical training in Sadiqabad with computer lab access, weekly practical assessments, and comprehensive online recorded programs designed for real-world digital careers.'}
            </p>

            {/* Main Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/courses">
                <Button variant="accent" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  {isRoman ? 'Courses Dekhein' : 'Explore Courses'}
                </Button>
              </Link>

              <Link to="/join">
                <Button variant="primary" size="lg" leftIcon={<GraduationCap className="w-4 h-4" />}>
                  {t.nav.join}
                </Button>
              </Link>

              <a
                href={`https://wa.me/92${(settings?.whatsapp || siteConfig.whatsapp).replace(/[^0-9]/g, '').slice(1)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="lg" leftIcon={<Phone className="w-4 h-4 text-emerald-600" />}>
                  {isRoman ? 'WhatsApp Rabta' : 'WhatsApp Us'}
                </Button>
              </a>
            </div>

            {/* Trust & Structure Points */}
            <div className="pt-4 border-t border-[#1F3FBF]/15 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#0F1F5C]/85">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1F3FBF] shrink-0" />
                <span className="font-semibold">{isRoman ? '6-Mah Physical Package' : '6-Month Physical Package'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1F3FBF] shrink-0" />
                <span className="font-semibold">{isRoman ? 'Computer Lab Workstations' : 'Computer Lab Workstations'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1F3FBF] shrink-0" />
                <span className="font-semibold">{isRoman ? '70% Pass Quality Standard' : '70% Passing Quality Bar'}</span>
              </div>
            </div>
          </div>

          {/* Quick Overview Feature Card (5 cols) */}
          <div className="lg:col-span-5">
            <Card elevated bordered className="border-2 border-[#1F3FBF]/20 bg-white overflow-hidden shadow-lg">
              {/* Optional Hero Package Image (Teacher lecturing students) */}
              {heroPackageImage && (
                <div className="w-full h-44 overflow-hidden border-b border-slate-200/80 bg-slate-100">
                  <img
                    src={heroPackageImage}
                    alt="Physical Academy Classroom Session"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              <CardHeader className="bg-[#0F1F5C] text-white">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#FFC20E] font-bold">
                    Sadiqabad Physical Campus
                  </span>
                  <Badge variant="accent" size="sm">
                    {isRoman ? 'Dakhlay Jari Hain' : 'Admissions Open'}
                  </Badge>
                </div>
                <CardTitle className="text-white mt-1.5 text-lg sm:text-xl">
                  Physical Students Package
                </CardTitle>
                <CardDescription className="text-white/80 text-xs">
                  06 Months Complete Package &bull; Total {courseCount} Courses together
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-2.5 pt-4 text-xs text-[#0F1F5C]">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F2F5FF]">
                  <span className="font-semibold">{isRoman ? 'Monthly Lab Charges:' : 'Monthly Lab Charges:'}</span>
                  <span className="font-bold text-[#1F3FBF] text-sm">only Rs. {monthlyFee.toLocaleString()}/-</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F2F5FF]">
                  <span className="font-semibold">{isRoman ? 'Dakhla Fee:' : 'Admission Fee:'}</span>
                  <span className="font-bold text-emerald-700 text-xs">No Admission Fee</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F2F5FF]">
                  <span className="font-semibold">{isRoman ? 'Chhupe Ikhtayarat:' : 'Hidden Charges:'}</span>
                  <span className="font-bold text-emerald-700 text-xs">No hidden charges</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F2F5FF]">
                  <span className="font-semibold">{isRoman ? 'Working Days:' : 'Working Days:'}</span>
                  <span className="font-medium text-slate-700">{workingDays}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0F1F5C]/5 border border-[#0F1F5C]/10">
                  <span className="font-extrabold text-[#0F1F5C]">{isRoman ? 'Kul Package:' : 'Total Package:'}</span>
                  <span className="font-black text-[#1F3FBF] text-base">Rs. {totalFee.toLocaleString()}/-</span>
                </div>
              </CardContent>

              <CardFooter className="flex items-center justify-between gap-3 pt-3">
                <Link to="/join/physical" className="w-full">
                  <Button variant="primary" fullWidth size="sm">
                    {isRoman ? 'Physical Dakhla Tafseelat' : 'Physical Admission Details'}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </div>
      </Container>
    </Section>
  );
};
