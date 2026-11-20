import React, { useState, useEffect } from 'react';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';
import { Button } from '../ui/Button';
import { CourseCard } from '../courses/CourseCard';
import { CourseModal } from '../courses/CourseModal';
import { OFFICIAL_COURSES, CourseData } from '../../config/courses';
import { CourseService } from '../../services/courseService';
import { useTranslation } from '../../i18n';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export const FeaturedCoursesSection: React.FC = () => {
  const { language } = useTranslation();
  const isRoman = language === 'roman-urdu';

  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [courses, setCourses] = useState<any[]>(OFFICIAL_COURSES.filter((c) => c.isFeatured));

  useEffect(() => {
    async function loadPublished() {
      try {
        const { data } = await CourseService.getCourses({ status: 'published', featured: true });
        if (data && data.length > 0) {
          // Sort most popular first if flag exists
          const sorted = [...data].sort((a, b) => {
            if (a.isMostPopular && !b.isMostPopular) return -1;
            if (!a.isMostPopular && b.isMostPopular) return 1;
            return a.displayOrder - b.displayOrder;
          });
          setCourses(sorted.slice(0, 3));
        }
      } catch (err) {
        console.warn('Fallback to static featured courses:', err);
      }
    }
    loadPublished();
  }, []);

  return (
    <Section variant="white" spacing="lg" id="featured-courses">
      <Container size="lg">
        <SectionHeading
          eyebrow={isRoman ? 'Khas Courses' : 'Featured Programs'}
          title={isRoman ? 'Numaya Practical Skills' : 'Top In-Demand Career Programs'}
          description={
            isRoman
              ? 'Market ki zaroorat ke mutabiq tayyar kiye gaye ahem courses jin se tulba kam waqt mein practical maharat hasil kar sakte hain.'
              : 'Our flagship commercial training courses engineered to prepare students for rapid career advancement and remote client earnings.'
          }
          align="center"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onSelectCourse={(c) => setSelectedCourse(c)}
              featuredHighlight
              hideDuration
            />
          ))}
        </div>

        {/* Action: Baqi Courses Dekhein / See Remaining Courses */}
        <div className="mt-12 text-center pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="text-xs sm:text-sm text-[#0F1F5C]/80 font-medium">
            {isRoman
              ? 'Hamare pas kul 10 mukammal technical aur business courses dastiyab hain.'
              : 'We offer a total of 10 comprehensive commercial and technical programs.'}
          </p>

          <Link to="/courses">
            <Button
              variant="primary"
              size="md"
              leftIcon={<BookOpen className="w-4 h-4" />}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isRoman ? 'Baqi Courses Dekhein (All 10)' : 'See Remaining Courses (All 10)'}
            </Button>
          </Link>
        </div>

        {/* Course Details Modal */}
        <CourseModal
          course={selectedCourse}
          isOpen={Boolean(selectedCourse)}
          onClose={() => setSelectedCourse(null)}
        />
      </Container>
    </Section>
  );
};
