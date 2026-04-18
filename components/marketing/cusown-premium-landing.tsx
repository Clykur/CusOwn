'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from 'framer-motion';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarCheck2,
  Check,
  ChevronDown,
  ClipboardList,
  Dumbbell,
  Heart,
  Home,
  LayoutDashboard,
  ListChecks,
  MapPin,
  MessageCircle,
  QrCode,
  Scissors,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import {
  CUSOWN_LANDING_PEXELS_VIDEO_URL,
  CUSOWN_LANDING_SECTION_IDS,
  CUSOWN_PRICING,
  CUSOWN_PRODUCT_PREVIEW_IMAGES,
  cusownAnnualBilledInr,
  formatCusownInr,
} from '@/config/marketing/cusown-landing';
import { ROUTES } from '@/lib/utils/navigation';
import { CusownMarketingNav } from '@/components/marketing/cusown-marketing-nav';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger: Variants = {
  show: { transition: { staggerChildren: 0.08 } },
};

const platformListContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const platformListItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const capabilitiesIntroStagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.04 },
  },
};

const capabilitiesIntroChild: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const capabilitiesRunwayItem: Variants = {
  hidden: { opacity: 0, x: 36, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] },
  },
};

const builtForIntroReveal: Variants = {
  hidden: { opacity: 0, filter: 'blur(10px)' },
  show: {
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.78, ease: [0.16, 1, 0.3, 1] },
  },
};

const builtForIntroRevealReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.28 } },
};

/** Shared scroll-in motion for Product preview and “Where it fits” lists (blur → sharp, stagger). */
const landingScrollStagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.16, delayChildren: 0.04 },
  },
};

const landingScrollPairStagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.14, delayChildren: 0 },
  },
};

const landingScrollRevealItem: Variants = {
  hidden: { opacity: 0, y: 48, scale: 0.94, filter: 'blur(14px)' },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.88, ease: [0.16, 1, 0.3, 1] },
  },
};

const landingScrollRevealReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.28 } },
};

const builtForFootReveal: Variants = {
  hidden: { opacity: 0, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const builtForFootRevealReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.24 } },
};

const PLATFORM_LANES = [
  {
    n: '01',
    title: 'For business owners',
    blurb: 'Launch a branded booking page, control availability, and stay close to customers.',
    items: [
      'Branded booking page',
      'WhatsApp confirmations',
      'Availability management',
      'Customer insights',
    ],
  },
  {
    n: '02',
    title: 'For customers',
    blurb: 'Book in seconds, get clear updates, and manage visits without friction.',
    items: ['Real-time slots', 'No account booking', 'Instant WhatsApp alerts', 'Manage bookings'],
  },
] as const;

const ROADMAP_ITEMS: readonly {
  name: string;
  status: string;
  live: boolean;
  Icon: LucideIcon;
}[] = [
  { name: 'Salons', status: 'Live', live: true, Icon: Scissors },
  { name: 'Clinics', status: 'Coming soon', live: false, Icon: Stethoscope },
  { name: 'Fitness', status: 'Coming soon', live: false, Icon: Dumbbell },
  { name: 'Consultants', status: 'Coming soon', live: false, Icon: Briefcase },
  { name: 'Home Services', status: 'Coming soon', live: false, Icon: Home },
];

const CAPABILITY_GROUPS: readonly {
  label: string;
  blurb: string;
  items: readonly { title: string; desc: string; Icon: LucideIcon }[];
}[] = [
  {
    label: 'Booking & reach',
    blurb: 'How people discover you and reserve time.',
    items: [
      {
        title: 'Online Booking',
        desc: 'Real-time slots customers can trust, no phone tag.',
        Icon: CalendarCheck2,
      },
      {
        title: 'WhatsApp Notifications',
        desc: 'Confirmations and nudges where people already live.',
        Icon: MessageCircle,
      },
      {
        title: 'QR Code Links',
        desc: 'Print-ready entry points to your booking page.',
        Icon: QrCode,
      },
    ],
  },
  {
    label: 'Control & trust',
    blurb: 'How you operate day-to-day with confidence.',
    items: [
      {
        title: 'Dashboard',
        desc: 'See the day at a glance and move with clarity.',
        Icon: LayoutDashboard,
      },
      {
        title: 'Mobile Ready',
        desc: 'Owners and customers, on any screen.',
        Icon: Smartphone,
      },
      {
        title: 'Secure Access',
        desc: 'Thoughtful permissions for serious operations.',
        Icon: ShieldCheck,
      },
    ],
  },
];

const CAPABILITY_TOTAL_COUNT = CAPABILITY_GROUPS.reduce((n, g) => n + g.items.length, 0);

const BUILT_FOR_CONTEXTS: readonly { title: string; description: string; Icon: LucideIcon }[] = [
  {
    title: 'Salons & beauty',
    description:
      'Treatments, staff, and time blocks stay legible so clients pick the right service without a long back-and-forth.',
    Icon: Scissors,
  },
  {
    title: 'Fitness & coaching',
    description:
      'Sessions and recurring slots stay structured instead of living in scattered chats and spreadsheets.',
    Icon: Dumbbell,
  },
  {
    title: 'Clinics & consults',
    description:
      'A clear daily view of who is coming in helps the front desk stay composed when the schedule shifts.',
    Icon: Stethoscope,
  },
  {
    title: 'Local & home services',
    description:
      'One branded link and tidy confirmations replace “what time works?” loops when you are already on the move.',
    Icon: Home,
  },
];

const PRODUCT_PREVIEW_POINTS: readonly { title: string; description: string }[] = [
  {
    title: 'Branded booking page',
    description: 'Your logo, story, and services in one calm page customers recognize.',
  },
  {
    title: 'Live availability',
    description: 'Honest slots that stay in sync so double bookings rarely happen.',
  },
  {
    title: 'WhatsApp confirmations',
    description: 'Short, clear messages when something is booked or needs attention.',
  },
];

const FAQ_ITEMS: readonly { q: string; a: string }[] = [
  {
    q: 'Do customers need an account to book?',
    a: 'No. They choose a slot, get a clear confirmation often on WhatsApp, and they are done.',
  },
  {
    q: 'Can I use my own branding?',
    a: 'Yes. Your booking page reflects your business, and the whole flow still feels like you.',
  },
  {
    q: 'How do WhatsApp confirmations work?',
    a: 'Customers receive concise updates when something is confirmed or changes, so nobody is left guessing.',
  },
  {
    q: 'Can I control booking approvals?',
    a: 'You decide what is instant versus what needs a quick yes or no from you first.',
  },
  {
    q: 'Is there a free trial?',
    a: `Only the first ${CUSOWN_PRICING.trialDays} days are complimentary, with full product access. After that it is ${formatCusownInr(CUSOWN_PRICING.monthlyInr)} per month, or ${formatCusownInr(cusownAnnualBilledInr())} per year if you choose annual billing (${CUSOWN_PRICING.annualDiscountPercent}% off the ${formatCusownInr(CUSOWN_PRICING.annualListInr)} list year).`,
  },
  {
    q: 'Does it work on mobile?',
    a: 'Owners and customers both use it comfortably on phones, so no app required.',
  },
];

type ProcessArchStep = {
  readonly code: string;
  readonly detail: string;
  readonly Icon: LucideIcon;
};

const PROCESS_OWNER_ARCH: readonly ProcessArchStep[] = [
  {
    code: 'Set up',
    detail: 'Add your business, hours, and what you offer.',
    Icon: Building2,
  },
  {
    code: 'Share',
    detail: 'Give customers a link or QR code to your page.',
    Icon: QrCode,
  },
  {
    code: 'Decide',
    detail: 'Approve or decline each booking request.',
    Icon: ListChecks,
  },
  {
    code: 'Grow',
    detail: 'Fill your calendar with steady demand.',
    Icon: TrendingUp,
  },
];

const PROCESS_CUSTOMER_ARCH: readonly ProcessArchStep[] = [
  {
    code: 'Find',
    detail: 'See businesses and services near you.',
    Icon: MapPin,
  },
  {
    code: 'Choose',
    detail: 'Pick the exact service before you book.',
    Icon: ClipboardList,
  },
  {
    code: 'Book',
    detail: 'Select an open time that works for you.',
    Icon: CalendarCheck2,
  },
  {
    code: 'Visit',
    detail: 'Arrive and get the service you booked.',
    Icon: Heart,
  },
];

function BookingFlowsDiagram() {
  const reduceMotion = useReducedMotion();
  const rm = !!reduceMotion;

  const listVariants: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: rm ? 0 : 0.08, delayChildren: rm ? 0 : 0.05 },
    },
  };

  const stepVariants: Variants = {
    hidden: { opacity: rm ? 1 : 0, y: rm ? 0 : 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: rm ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <figure className="relative mx-auto max-w-6xl">
      <figcaption className="sr-only">
        Flow A owner supply: {PROCESS_OWNER_ARCH.map((s) => `${s.code}, ${s.detail}`).join('. ')}.
        Flow B customer demand:{' '}
        {PROCESS_CUSTOMER_ARCH.map((s) => `${s.code}, ${s.detail}`).join('. ')}.
      </figcaption>

      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:mb-10 sm:text-[15px]">
        Owners build and run availability on the left. Customers discover and book on the right.
        Both run on the same live core in the middle, so no extra layers.
      </p>

      <div className="flex flex-col lg:flex-row lg:items-stretch lg:gap-8 xl:gap-12">
        <BookingFlowColumn
          flowLabel="Flow A · Owner supply"
          flowSummary="Set up → share link → decide on requests → grow bookings"
          steps={PROCESS_OWNER_ARCH}
          progressLabel="Owner progress"
          listVariants={listVariants}
          stepVariants={stepVariants}
          rm={rm}
        />

        <div
          className="relative my-10 flex items-center gap-4 lg:my-0 lg:w-16 lg:shrink-0 lg:flex-col lg:justify-center lg:gap-6 lg:px-1"
          aria-hidden
        >
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/12 to-transparent lg:hidden" />
          <p className="relative z-[1] shrink-0 bg-zinc-950 px-1 py-0.5 text-center font-mono text-[9px] font-semibold uppercase tracking-[0.28em] text-accent sm:text-[10px]">
            Shared core
          </p>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/12 to-transparent lg:hidden" />
          <div className="pointer-events-none absolute inset-y-10 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#22c55e]/70 to-transparent shadow-[0_0_18px_rgba(34,197,94,0.35)] lg:block" />
        </div>

        <BookingFlowColumn
          flowLabel="Flow B · Customer demand"
          flowSummary="Find nearby → choose a service → book a time → visit"
          steps={PROCESS_CUSTOMER_ARCH}
          progressLabel="Customer progress"
          listVariants={listVariants}
          stepVariants={stepVariants}
          rm={rm}
        />
      </div>
    </figure>
  );
}

function BookingFlowColumn({
  flowLabel,
  flowSummary,
  steps,
  progressLabel,
  listVariants,
  stepVariants,
  rm,
}: {
  flowLabel: string;
  flowSummary: string;
  steps: readonly ProcessArchStep[];
  progressLabel: string;
  listVariants: Variants;
  stepVariants: Variants;
  rm: boolean;
}) {
  return (
    <motion.div
      className="min-w-0 flex-1"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-50px' }}
      variants={listVariants}
    >
      <header>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-accent sm:text-[11px] sm:tracking-[0.26em]">
          {flowLabel}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-500 sm:text-sm">{flowSummary}</p>
      </header>

      <ol className="relative mt-7 list-none space-y-0 sm:mt-8">
        {steps.map((step, i) => {
          const Icon = step.Icon;
          return (
            <motion.li
              key={step.code}
              variants={stepVariants}
              className="relative flex items-start gap-4 pb-8 last:pb-0 sm:gap-5 sm:pb-9"
            >
              {i < steps.length - 1 ? (
                <span
                  className="absolute left-7 top-14 bottom-0 w-px bg-gradient-to-b from-[#22c55e]/45 to-white/[0.06] sm:left-8 sm:top-16"
                  aria-hidden
                />
              ) : null}
              <motion.div
                className="relative z-[1] flex h-14 w-14 shrink-0 items-center justify-center sm:h-16 sm:w-16"
                whileHover={
                  rm
                    ? undefined
                    : {
                        scale: 1.06,
                        filter: 'drop-shadow(0 0 14px rgba(34,197,94,0.45))',
                      }
                }
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              >
                <Icon
                  className="h-8 w-8 text-accent sm:h-9 sm:w-9"
                  strokeWidth={2.35}
                  aria-hidden
                />
              </motion.div>
              <div className="min-w-0 pt-1.5 sm:pt-2">
                <p className="font-display text-[15px] font-semibold tracking-tight text-white sm:text-base">
                  {step.code}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500 sm:text-sm">
                  {step.detail}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>

      <div className="mt-8 sm:mt-9">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.32em] text-zinc-600 sm:text-[10px] uppercase">
          {progressLabel}
        </p>
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-800 via-accent to-[#86efac]"
            initial={{ scaleX: rm ? 1 : 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{
              duration: rm ? 0 : 0.9,
              delay: rm ? 0 : 0.12,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              transformOrigin: '0% 50%',
              boxShadow: '0 0 16px rgba(34,197,94,0.35)',
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function BuiltForSection() {
  const reduceMotion = useReducedMotion();
  const introVariants = reduceMotion ? builtForIntroRevealReduced : builtForIntroReveal;
  const rowVariants = reduceMotion ? landingScrollRevealReduced : landingScrollRevealItem;
  const footVariants = reduceMotion ? builtForFootRevealReduced : builtForFootReveal;

  return (
    <section
      id={CUSOWN_LANDING_SECTION_IDS.builtFor}
      className="relative scroll-mt-[calc(5.75rem+env(safe-area-inset-top,0px))] md:scroll-mt-28 border-t border-white/5 bg-zinc-950 py-20 sm:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(34,197,94,0.045)_0%,transparent_42%,transparent_100%)]"
        aria-hidden
      />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mt-0 grid gap-14 lg:mt-0 lg:grid-cols-12 lg:items-start lg:gap-x-14 lg:gap-y-0">
          <div className="lg:col-span-5 lg:sticky lg:top-28 lg:z-10 lg:self-start lg:pt-2">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.22, margin: '-56px 0px' }}
              variants={introVariants}
            >
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-600 sm:text-[11px]">
                Where it fits
              </p>
              <h2 className="mt-5 font-display text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-3xl sm:leading-[1.08] lg:text-[2.125rem]">
                Built for businesses that run on{' '}
                <span className="bg-gradient-to-r from-white via-emerald-50 to-accent bg-clip-text text-transparent">
                  appointments
                </span>
              </h2>
              <p className="mt-6 max-w-md text-[15px] leading-[1.75] text-zinc-500 sm:text-base">
                CusOwn is shaped around service workflows: clear slots, calm confirmations, and one
                place to read the day.
              </p>
              <div
                className="mt-8 hidden h-px max-w-xs bg-gradient-to-r from-accent/35 via-white/15 to-transparent lg:block"
                aria-hidden
              />
            </motion.div>
          </div>

          <div className="min-w-0 lg:col-span-7">
            <motion.ul
              className="space-y-0"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15, margin: '-72px 0px' }}
              variants={landingScrollStagger}
            >
              {BUILT_FOR_CONTEXTS.map((ctx, i) => (
                <motion.li
                  key={ctx.title}
                  variants={rowVariants}
                  className="border-t border-white/[0.07] py-9 first:border-t-0 first:pt-0 sm:py-10"
                >
                  <div className="flex gap-5 sm:gap-6">
                    <span className="w-9 shrink-0 pt-0.5 text-right font-mono text-[11px] font-semibold tabular-nums text-zinc-600 sm:w-10 sm:text-xs">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1 border-l border-white/[0.08] pl-5 sm:pl-6">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <ctx.Icon
                          className="h-4 w-4 text-accent/85"
                          strokeWidth={2.25}
                          aria-hidden
                        />
                        <h3 className="font-display text-lg font-semibold tracking-tight text-white sm:text-xl">
                          {ctx.title}
                        </h3>
                      </div>
                      <p className="mt-3 text-[14px] leading-[1.7] text-zinc-500 sm:text-[15px]">
                        {ctx.description}
                      </p>
                    </div>
                  </div>
                </motion.li>
              ))}
            </motion.ul>

            <motion.p
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.18, margin: '-48px 0px' }}
              variants={footVariants}
              className="mt-12 text-[13px] leading-relaxed text-zinc-600 sm:mt-14 sm:text-[14px]"
            >
              Running a different shape of business? The same booking core still applies. Tune
              services, hours, and messaging to match how you work.
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductPreviewSection() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const desktopParallaxY = useTransform(scrollYProgress, [0, 1], [44, -44]);
  const mobileParallaxY = useTransform(scrollYProgress, [0, 1], [-32, 36]);
  const ownerParallaxY = useTransform(scrollYProgress, [0, 1], [36, -40]);
  const mediaItemVariants = reduceMotion ? landingScrollRevealReduced : landingScrollRevealItem;

  return (
    <section
      ref={sectionRef}
      id={CUSOWN_LANDING_SECTION_IDS.preview}
      className="relative scroll-mt-[calc(5.75rem+env(safe-area-inset-top,0px))] md:scroll-mt-28 border-t border-white/5 bg-zinc-950 py-28 sm:py-36"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_30%_40%,rgba(34,197,94,0.07),transparent_58%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_85%_75%,rgba(34,197,94,0.05),transparent_55%)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-3xl lg:text-left"
        >
          <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.28em] text-zinc-500">
            Product
          </p>
          <h2 className="font-display text-[2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl sm:leading-[1.06] lg:text-[2.75rem]">
            A surface worthy of{' '}
            <span className="bg-gradient-to-r from-white via-emerald-50 to-accent bg-clip-text text-transparent">
              how you work
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-[1.7] text-zinc-500 sm:text-lg lg:mx-0">
            The same calm experience in the browser, on the phone, and behind the scenes.
          </p>
          <div
            className="mx-auto mt-8 h-px max-w-xs bg-gradient-to-r from-transparent via-white/20 to-transparent lg:mx-0"
            aria-hidden
          />
        </motion.div>

        <div className="mt-14 grid gap-14 lg:mt-20 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-16 xl:gap-20">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            variants={fadeUp}
            className="lg:sticky lg:top-28 lg:pt-2"
          >
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-600">
              What ships today
            </p>
            <ul className="mt-8 space-y-0 border-t border-white/[0.07]">
              {PRODUCT_PREVIEW_POINTS.map((item, i) => (
                <li
                  key={item.title}
                  className="border-b border-white/[0.07] py-6 first:pt-6 sm:py-7"
                >
                  <div className="flex gap-4">
                    <span className="font-display text-2xl tabular-nums leading-none text-white/[0.14] sm:text-3xl">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="flex items-start gap-2 font-display text-base font-semibold tracking-tight text-white sm:text-lg">
                        <Check
                          className="mt-1 h-4 w-4 shrink-0 text-accent"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                        {item.title}
                      </p>
                      <p className="mt-2 text-[14px] leading-relaxed text-zinc-500 sm:text-[15px]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="flex min-w-0 flex-col gap-8 lg:gap-10"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2, margin: '-64px 0px' }}
            variants={landingScrollStagger}
          >
            <motion.div
              variants={mediaItemVariants}
              className="group min-w-0 will-change-transform"
              style={reduceMotion ? undefined : { y: desktopParallaxY }}
            >
              <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-zinc-900/40 ring-1 ring-white/[0.04]">
                <div
                  className="flex items-center gap-2 border-b border-white/[0.06] bg-zinc-900/60 px-4 py-3 sm:px-5"
                  aria-hidden
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
                  <span className="ml-3 flex-1 truncate rounded-md bg-white/[0.06] px-3 py-1.5 text-center font-mono text-[10px] text-zinc-500 sm:text-[11px]">
                    yourbrand.cusown.app / book
                  </span>
                </div>
                <div className="relative aspect-[16/10] w-full bg-zinc-900">
                  <Image
                    src={CUSOWN_PRODUCT_PREVIEW_IMAGES.desktop}
                    alt="Desktop booking experience"
                    fill
                    className="object-cover object-top transition-transform duration-[1.05s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02]"
                    sizes="(max-width: 1024px) 100vw, min(896px, 55vw)"
                  />
                </div>
              </div>
              <p className="mt-4 text-center font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-600 sm:text-left">
                Customer booking · Desktop
              </p>
            </motion.div>

            <motion.div
              variants={landingScrollPairStagger}
              className="grid gap-8 sm:grid-cols-2 sm:gap-6 lg:gap-8"
            >
              <motion.figure
                variants={mediaItemVariants}
                className="group min-w-0 will-change-transform"
                style={reduceMotion ? undefined : { y: mobileParallaxY }}
              >
                <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-zinc-900/30 ring-1 ring-white/[0.04]">
                  <div className="relative mx-auto aspect-[10/16] w-full max-w-[min(82vw,300px)] sm:mx-0 sm:max-w-none">
                    <Image
                      src={CUSOWN_PRODUCT_PREVIEW_IMAGES.mobile}
                      alt="Mobile booking screen"
                      fill
                      className="object-cover object-center transition-transform duration-[1.05s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                      sizes="(max-width: 640px) 220px, (max-width: 1024px) 45vw, 320px"
                    />
                  </div>
                </div>
                <figcaption className="mt-4 text-center font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-600 sm:text-left">
                  Same flow · Phone
                </figcaption>
              </motion.figure>

              <motion.figure
                variants={mediaItemVariants}
                className="group min-w-0 will-change-transform"
                style={reduceMotion ? undefined : { y: ownerParallaxY }}
              >
                <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-zinc-900/30 ring-1 ring-white/[0.04]">
                  <div className="relative aspect-[4/3] w-full bg-zinc-900">
                    <Image
                      src={CUSOWN_PRODUCT_PREVIEW_IMAGES.owner}
                      alt="Owner workspace and schedule"
                      fill
                      className="object-cover object-center transition-transform duration-[1.05s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02]"
                      sizes="(max-width: 1024px) 100vw, min(480px, 45vw)"
                    />
                  </div>
                </div>
                <figcaption className="mt-4 text-center font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-600 sm:text-left">
                  How your day looks · Owner
                </figcaption>
              </motion.figure>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const annualBilled = cusownAnnualBilledInr();
  const annualSavings = CUSOWN_PRICING.annualListInr - annualBilled;
  const planFeatures = [
    'Unlimited bookings',
    'WhatsApp confirmations',
    'Branded booking page',
    'Dashboard and operations',
    'Advanced insights',
  ] as const;

  const planFeatureList = (keyPrefix: string) => (
    <ul className="relative mt-10 space-y-0 border-t border-white/[0.08]">
      {planFeatures.map((line) => (
        <li
          key={`${keyPrefix}-${line}`}
          className="flex items-start gap-4 border-b border-white/[0.06] py-4 sm:py-[1.125rem]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent shadow-[0_0_22px_-8px_rgba(34,197,94,0.45)]">
            <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
          </span>
          <span className="pt-1 text-[15px] leading-snug text-zinc-200 sm:text-base">{line}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <section
      id={CUSOWN_LANDING_SECTION_IDS.pricing}
      className="relative scroll-mt-[calc(5.75rem+env(safe-area-inset-top,0px))] md:scroll-mt-28 overflow-hidden border-t border-white/5 bg-zinc-950 py-28 sm:py-36 lg:py-40"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(34,197,94,0.11),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_15%_85%,rgba(34,197,94,0.07),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_92%_60%,rgba(34,197,94,0.05),transparent_52%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0)_0%,rgba(9,9,11,0.5)_100%)]" />
      </div>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-[20%] top-[25%] h-[420px] w-[420px] rounded-full bg-accent/16 blur-[120px]"
        animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.05, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-[15%] bottom-[10%] h-[380px] w-[380px] rounded-full bg-emerald-400/10 blur-[110px]"
        animate={{ opacity: [0.28, 0.48, 0.28] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      <div
        className="pointer-events-none absolute left-1/2 top-0 h-px w-[min(100%,40rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="mx-auto mb-8 inline-flex items-center gap-4 font-mono text-[10px] font-semibold uppercase tracking-[0.34em] text-accent/90 sm:mb-9 sm:text-[11px] sm:tracking-[0.38em]">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-accent/70 sm:w-10" />
            Pricing
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-accent/70 sm:w-10" />
          </p>
          <h2 className="font-display text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-4xl sm:leading-[1.06] lg:text-[2.75rem]">
            Simple pricing,{' '}
            <span className="bg-gradient-to-r from-white via-emerald-50 to-accent bg-clip-text text-transparent">
              no surprises
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[15px] leading-[1.7] text-zinc-500 sm:mt-7 sm:text-lg">
            Your first {CUSOWN_PRICING.trialDays} days are free with full access. After that, pay
            monthly or save on an annual bill.
          </p>
        </motion.div>

        <div className="relative mx-auto mt-16 max-w-5xl sm:mt-20">
          <div
            className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.1] to-transparent"
            aria-hidden
          />

          <div className="relative mt-14 grid lg:mt-16 lg:grid-cols-2 lg:gap-0">
            <div
              className="pointer-events-none absolute left-1/2 top-12 hidden h-[calc(100%-6rem)] w-px -translate-x-1/2 bg-gradient-to-b from-accent/25 via-white/10 to-transparent lg:block"
              aria-hidden
            />

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
              className="relative lg:pr-12 xl:pr-16"
            >
              <div
                className="pointer-events-none absolute -left-8 top-0 h-72 w-72 rounded-full bg-accent/15 blur-[88px] sm:h-80 sm:w-80"
                aria-hidden
              />
              <div className="relative">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.26em] text-accent sm:text-[11px]">
                  Monthly
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-3 sm:gap-4">
                  <h3 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    {formatCusownInr(CUSOWN_PRICING.monthlyInr)}
                  </h3>
                  <span className="pb-1 font-mono text-[11px] font-medium text-zinc-500 sm:text-xs">
                    per month after trial
                  </span>
                </div>
                <p className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600 sm:text-[11px]">
                  {CUSOWN_PRICING.trialDays} day trial · then billed monthly
                </p>
                <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-zinc-500 sm:text-[15px]">
                  Full product during the trial. When it ends, this is your month to month rate
                  unless you switch to annual.
                </p>
                {planFeatureList('monthly')}
              </div>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
              className="relative mt-14 border-t border-white/[0.07] pt-14 lg:mt-0 lg:border-t-0 lg:pl-12 lg:pt-0 xl:pl-16"
            >
              <div
                className="pointer-events-none absolute -right-4 bottom-0 h-64 w-64 rounded-full bg-white/[0.04] blur-[80px] lg:-right-8"
                aria-hidden
              />
              <div className="relative">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.26em] text-accent sm:text-[11px]">
                  Yearly · save {CUSOWN_PRICING.annualDiscountPercent}%
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-3 sm:gap-4">
                  <h3 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    {formatCusownInr(annualBilled)}
                  </h3>
                  <span className="pb-1 font-mono text-[11px] font-medium text-zinc-500 sm:text-xs">
                    per year billed once
                  </span>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-zinc-600 sm:text-[11px]">
                  <span className="line-through decoration-white/25">
                    {formatCusownInr(CUSOWN_PRICING.annualListInr)} list year
                  </span>
                  <span className="text-accent/90">save {formatCusownInr(annualSavings)}</span>
                </p>
                <p className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600 sm:text-[11px]">
                  {CUSOWN_PRICING.trialDays} day trial · same features · pay yearly after
                </p>
                <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-zinc-500 sm:text-[15px]">
                  One invoice for twelve months at the discounted rate. Same capabilities as
                  monthly, less total outlay.
                </p>
                {planFeatureList('annual')}
              </div>
            </motion.div>
          </div>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          className="mx-auto mt-16 max-w-xl sm:mt-20"
        >
          <div
            className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
            aria-hidden
          />
          <p className="mt-8 text-center font-display text-base font-medium text-zinc-300 sm:mt-9 sm:text-lg">
            {CUSOWN_PRICING.trialDays} days free, then {formatCusownInr(CUSOWN_PRICING.monthlyInr)}{' '}
            per month or {formatCusownInr(annualBilled)} per year (
            {CUSOWN_PRICING.annualDiscountPercent}% off{' '}
            {formatCusownInr(CUSOWN_PRICING.annualListInr)} list year).
          </p>
          <p className="mx-auto mt-3 max-w-md text-center text-[13px] leading-relaxed text-zinc-600 sm:text-sm">
            No permanent free plan. The trial is the only complimentary period. Pick monthly or
            annual billing when it ends.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function LandingFaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section
      id={CUSOWN_LANDING_SECTION_IDS.faq}
      className="relative scroll-mt-[calc(5.75rem+env(safe-area-inset-top,0px))] md:scroll-mt-28 overflow-hidden border-t border-white/[0.06] bg-zinc-950 py-28 sm:py-36 lg:py-40"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_50%_at_50%_-15%,rgba(34,197,94,0.1),transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_40%_at_10%_90%,rgba(34,197,94,0.06),transparent_52%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_92%_75%,rgba(34,197,94,0.05),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0)_0%,rgba(9,9,11,0.45)_100%)]" />
      </div>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[20%] h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-accent/12 blur-[100px]"
        animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.06, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-[15%] bottom-[15%] h-[280px] w-[280px] rounded-full bg-emerald-400/10 blur-[95px]"
        animate={{ opacity: [0.25, 0.42, 0.25] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      <div
        className="pointer-events-none absolute left-1/2 top-0 h-px w-[min(100%,36rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-4xl lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="text-center"
        >
          <p className="mx-auto mb-8 inline-flex items-center gap-4 font-mono text-[10px] font-semibold uppercase tracking-[0.34em] text-accent/90 sm:mb-9 sm:text-[11px] sm:tracking-[0.38em]">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-accent/70 sm:w-10" />
            FAQ
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-accent/70 sm:w-10" />
          </p>
          <h2 className="font-display text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-4xl sm:leading-[1.06] lg:text-[2.75rem]">
            Questions,{' '}
            <span className="bg-gradient-to-r from-white via-emerald-50 to-accent bg-clip-text text-transparent">
              answered
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[15px] leading-[1.7] text-zinc-500 sm:mt-7 sm:text-lg">
            Straight answers in plain language. Nothing buried in fine print.
          </p>
          <div
            className="mx-auto mt-8 h-px max-w-md bg-gradient-to-r from-transparent via-white/15 to-transparent sm:mt-9"
            aria-hidden
          />
        </motion.div>

        <div className="mt-12 sm:mt-14">
          {FAQ_ITEMS.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <motion.div
                key={item.q}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-24px' }}
                variants={fadeUp}
                className={`border-b border-white/[0.07] transition-[background-color,box-shadow] duration-300 ${
                  open ? 'bg-white/[0.02] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]' : ''
                }`}
              >
                <div className="flex gap-0 sm:gap-1">
                  <div
                    className={`w-0.5 shrink-0 rounded-full transition-colors duration-300 ${
                      open ? 'bg-accent shadow-[0_0_14px_rgba(34,197,94,0.35)]' : 'bg-transparent'
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setOpenIdx(open ? null : idx)}
                      className="group flex w-full items-start justify-between gap-4 py-5 pr-3 text-left transition-colors sm:py-6 sm:pr-4"
                      aria-expanded={open}
                    >
                      <span className="flex min-w-0 items-start gap-3 sm:gap-4">
                        <span className="mt-0.5 font-mono text-[10px] font-semibold tabular-nums text-zinc-600 transition-colors group-hover:text-zinc-500 sm:text-[11px]">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={`text-[15px] font-medium leading-snug transition-colors sm:text-base ${
                            open ? 'text-white' : 'text-zinc-200 group-hover:text-white'
                          }`}
                        >
                          {item.q}
                        </span>
                      </span>
                      <ChevronDown
                        className={`mt-1 h-5 w-5 shrink-0 transition-all duration-300 ${
                          open
                            ? 'rotate-180 text-accent'
                            : 'text-zinc-500 group-hover:text-zinc-400'
                        }`}
                        strokeWidth={2}
                        aria-hidden
                      />
                    </button>
                    {open ? (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <p className="pb-5 pl-[2.35rem] pr-3 text-[14px] leading-[1.75] text-zinc-500 sm:pb-6 sm:pl-[2.75rem] sm:pr-4 sm:text-[15px]">
                          {item.a}
                        </p>
                      </motion.div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ForwardLookingStrip() {
  return (
    <div className="border-t border-white/5 bg-zinc-950 px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8">
      <p className="font-display text-lg font-semibold tracking-tight text-white sm:text-xl">
        Built to expand with your business
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
        Payments, reminders, and deeper insights — coming next.
      </p>
    </div>
  );
}

function HeroVideo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inView = useInView(wrapRef, { amount: 0.2, once: false });
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (inView && !src) {
      setSrc(CUSOWN_LANDING_PEXELS_VIDEO_URL);
    }
  }, [inView, src]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    const p = el.play();
    if (p !== undefined) {
      p.catch(() => {});
    }
  }, [src]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {src ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full scale-[1.08] object-cover motion-safe:transition-transform motion-safe:duration-[2.5s] motion-safe:ease-out"
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-950" aria-hidden />
      )}
    </div>
  );
}

export function CusownPremiumLanding() {
  const router = useRouter();
  const capabilitiesSectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: capabilitiesScrollProgress } = useScroll({
    target: capabilitiesSectionRef,
    offset: ['start 0.82', 'end 0.18'],
  });
  const capabilitiesProgressGlow = useTransform(
    capabilitiesScrollProgress,
    [0, 0.5, 1],
    ['rgba(34,197,94,0.15)', 'rgba(34,197,94,0.35)', 'rgba(34,197,94,0.2)']
  );
  const capabilitiesProgressShadow = useTransform(
    capabilitiesScrollProgress,
    [0, 1],
    ['0 0 0 0 transparent', '0 0 28px 2px rgba(34,197,94,0.4)']
  );

  const go = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    if (!raw) return;
    const id = decodeURIComponent(raw);
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="marketing-safe-x relative min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100">
      <div
        className="pointer-events-none fixed inset-0 z-[100] grain-overlay mix-blend-overlay"
        aria-hidden
      />

      <CusownMarketingNav sectionNavMode="landing" />

      <section className="relative flex min-h-[100svh] items-center overflow-hidden pt-[max(6rem,calc(env(safe-area-inset-top,0px)+4.75rem))] pb-20 sm:pt-28 sm:pb-24">
        <div className="absolute inset-0 overflow-hidden">
          <HeroVideo />
        </div>

        <div
          className="absolute inset-0 bg-gradient-to-b from-zinc-950/90 via-zinc-950/35 to-zinc-950"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/30 to-zinc-950/80"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(34,197,94,0.12),transparent_50%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_55%_at_50%_108%,rgba(34,197,94,0.16),transparent_52%)] sm:hidden"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,0,0,0.5),transparent_50%)]"
          aria-hidden
        />

        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-[45%] top-[8%] h-[min(120vw,720px)] w-[min(120vw,720px)] rounded-full bg-accent/30 blur-[100px] sm:-left-[35%] sm:top-[12%]"
          animate={{ opacity: [0.45, 0.72, 0.45], scale: [1, 1.06, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-[40%] bottom-[-10%] h-[min(100vw,600px)] w-[min(100vw,600px)] rounded-full bg-emerald-400/15 blur-[110px]"
          animate={{ opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <div
          className="pointer-events-none absolute left-[12%] top-[38%] h-64 w-64 rounded-full bg-white/[0.03] blur-3xl"
          aria-hidden
        />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="relative max-w-[46rem]"
          >
            <motion.p
              variants={fadeUp}
              className="mb-6 text-[11px] font-medium uppercase tracking-[0.28em] text-zinc-500 sm:mb-7"
            >
              CusOwn — booking for service businesses
            </motion.p>

            <motion.h1
              variants={fadeUp}
              className="font-display text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.035em] text-white [text-shadow:0_2px_80px_rgba(0,0,0,0.45)] sm:text-5xl sm:leading-[1.04] lg:text-6xl lg:leading-[1.02] xl:text-[3.85rem]"
            >
              <span className="block text-zinc-400">The smarter way to</span>
              <span className="mt-2 block sm:mt-2.5">
                manage your{' '}
                <span className="relative inline-block">
                  <span
                    className="absolute -inset-x-2 -inset-y-1 -z-10 rounded-lg bg-accent/15 blur-xl"
                    aria-hidden
                  />
                  <span className="bg-gradient-to-r from-white via-emerald-50 to-accent bg-clip-text text-transparent">
                    appointments
                  </span>
                </span>
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-7 max-w-xl text-[1.0625rem] leading-[1.72] text-zinc-400 sm:mt-9 sm:text-lg sm:leading-[1.65]"
            >
              Your brand, your availability, your confirmations one quiet system that makes booking
              feel inevitable for customers and invisible work for you.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-9 flex flex-col gap-3 sm:mt-12 sm:flex-row sm:items-center sm:gap-4"
            >
              <motion.button
                type="button"
                onClick={() => go(ROUTES.SELECT_ROLE())}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full bg-accent px-8 py-3.5 text-[15px] font-semibold text-zinc-950 shadow-[0_0_48px_-8px_rgba(34,197,94,0.55)] transition-[box-shadow,transform] hover:shadow-[0_0_64px_-4px_rgba(34,197,94,0.65)] sm:min-h-0 sm:py-0 sm:text-sm"
              >
                Start {CUSOWN_PRICING.trialDays}-day trial
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.25}
                />
              </motion.button>
              <motion.button
                type="button"
                onClick={() => go(ROUTES.SELECT_ROLE('customer'))}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/20 bg-transparent px-8 py-3.5 text-[15px] font-semibold text-white transition-colors hover:border-white/35 hover:bg-white/[0.06] sm:min-h-0 sm:py-0 sm:text-sm"
              >
                Browse businesses
              </motion.button>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-12 flex flex-col gap-3 text-sm text-zinc-500 sm:mt-14 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1 sm:gap-y-2"
            >
              {[
                `${CUSOWN_PRICING.trialDays}-day trial`,
                `Then ${formatCusownInr(CUSOWN_PRICING.monthlyInr)}/mo or save yearly`,
                'Setup in minutes',
              ].map((t, i) => (
                <span key={t} className="inline-flex items-center gap-1 sm:gap-0">
                  {i > 0 ? (
                    <span className="hidden px-3 text-zinc-700 sm:inline" aria-hidden>
                      ·
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-2 text-zinc-400">
                    <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.5} />
                    {t}
                  </span>
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      <BuiltForSection />

      <section
        id={CUSOWN_LANDING_SECTION_IDS.platform}
        className="relative scroll-mt-[calc(5.75rem+env(safe-area-inset-top,0px))] md:scroll-mt-28 overflow-hidden bg-zinc-950 py-28 sm:py-36"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_65%_at_28%_42%,rgba(34,197,94,0.1),transparent_60%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_65%_at_72%_42%,rgba(34,197,94,0.1),transparent_60%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0)_0%,rgba(9,9,11,0.4)_100%)]"
          aria-hidden
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-[32%] top-[18%] h-[460px] w-[460px] rounded-full bg-accent/18 blur-[108px]"
          animate={{ opacity: [0.42, 0.62, 0.42], scale: [1, 1.04, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-[32%] top-[18%] h-[460px] w-[460px] rounded-full bg-accent/18 blur-[108px]"
          animate={{ opacity: [0.42, 0.62, 0.42], scale: [1, 1.04, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="max-w-4xl"
          >
            <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.28em] text-zinc-500">
              Platform
            </p>
            <h2 className="font-display text-[2.125rem] font-semibold leading-[1.07] tracking-[-0.035em] text-white [text-shadow:0_2px_60px_rgba(0,0,0,0.35)] sm:text-4xl sm:leading-[1.05] lg:text-5xl lg:leading-[1.04]">
              One platform,{' '}
              <span className="bg-gradient-to-r from-white via-emerald-50 to-accent bg-clip-text text-transparent">
                two experiences
              </span>
            </h2>
            <p className="mt-7 max-w-2xl text-[1.0625rem] leading-[1.75] text-zinc-400 sm:text-lg">
              Built for owners who run the day and customers who just need a time that works.
            </p>
            <div
              className="mt-10 h-px max-w-2xl bg-gradient-to-r from-transparent via-white/18 to-transparent"
              aria-hidden
            />
          </motion.div>

          <div className="relative mt-20 lg:mt-28">
            <div className="grid gap-16 lg:grid-cols-2 lg:gap-12 xl:gap-16">
              {PLATFORM_LANES.map((lane) => (
                <motion.div
                  key={lane.n}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-60px' }}
                  variants={fadeUp}
                  className="relative"
                >
                  <div
                    className="pointer-events-none absolute left-1/2 top-[28%] h-56 w-56 -translate-x-1/2 rounded-full bg-accent/10 blur-[76px]"
                    aria-hidden
                  />
                  <span
                    className="pointer-events-none absolute left-0 top-0 font-display text-[clamp(5rem,18vw,11rem)] font-semibold leading-[0.85] tracking-[-0.06em] text-white/[0.04]"
                    aria-hidden
                  >
                    {lane.n}
                  </span>
                  <div className="relative">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                      {lane.title}
                    </p>
                    <p className="mt-6 text-lg font-medium leading-[1.65] text-zinc-200 sm:text-xl sm:leading-[1.6]">
                      {lane.blurb}
                    </p>
                    <motion.ul
                      className="relative mt-10 border-t border-white/[0.07]"
                      variants={platformListContainer}
                      initial="hidden"
                      whileInView="show"
                      viewport={{ once: true, margin: '-20px' }}
                    >
                      {lane.items.map((item) => (
                        <motion.li
                          key={item}
                          variants={platformListItem}
                          className="group flex items-center gap-4 border-b border-white/[0.06] py-4 transition-colors last:border-b-0 hover:border-accent/15"
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent transition-[box-shadow,background-color] group-hover:bg-accent/18 group-hover:shadow-[0_0_20px_-4px_rgba(34,197,94,0.45)]"
                            aria-hidden
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={2.75} />
                          </span>
                          <span className="text-[15px] leading-snug text-zinc-300 transition-colors group-hover:text-zinc-100">
                            {item}
                          </span>
                        </motion.li>
                      ))}
                    </motion.ul>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ProductPreviewSection />

      <section
        id={CUSOWN_LANDING_SECTION_IDS.roadmap}
        className="relative scroll-mt-[calc(5.75rem+env(safe-area-inset-top,0px))] md:scroll-mt-28 overflow-hidden border-t border-white/5 bg-[#08080a] py-28 sm:py-36"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_100%_0%,rgba(34,197,94,0.12),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.2)_0%,rgba(9,9,11,0.92)_100%)]"
          aria-hidden
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="max-w-3xl"
          >
            <p className="mb-6 inline-flex items-center gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.32em] text-accent/90 sm:text-[11px]">
              <span
                className="h-px w-10 bg-gradient-to-r from-accent/60 to-transparent sm:w-12"
                aria-hidden
              />
              Roadmap
            </p>
            <h2 className="font-display text-[2.125rem] font-semibold leading-[1.12] tracking-[-0.035em] text-white sm:text-4xl sm:leading-[1.08] lg:text-[2.75rem] lg:leading-[1.06]">
              Starting with{' '}
              <span className="bg-gradient-to-r from-white via-emerald-50 to-accent bg-clip-text text-transparent">
                salons
              </span>
              , then wider{' '}
              <span className="bg-gradient-to-r from-white via-emerald-50 to-accent bg-clip-text text-transparent">
                verticals
              </span>
              .
            </h2>
            <p className="mt-6 max-w-xl text-[15px] leading-[1.7] text-zinc-500 sm:text-base">
              One live focus first, then adjacent industries.
            </p>
          </motion.div>

          {/* Mobile / tablet: compact runway list */}
          <ul className="mt-14 divide-y divide-white/[0.07] border-y border-white/[0.07] lg:hidden">
            {ROADMAP_ITEMS.map((c) => (
              <motion.li
                key={c.name}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-20px' }}
                variants={fadeUp}
                className="flex items-center gap-4 py-5 sm:gap-5 sm:py-6"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
                    c.live ? 'border-accent/35 bg-accent/10' : 'border-white/10 bg-zinc-900/50'
                  }`}
                  aria-hidden
                >
                  <c.Icon
                    className={`h-5 w-5 ${c.live ? 'text-accent' : 'text-zinc-500'}`}
                    strokeWidth={1.75}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold text-white">{c.name}</p>
                  <p
                    className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                      c.live ? 'text-accent' : 'text-zinc-500'
                    }`}
                  >
                    {c.status}
                  </p>
                </div>
                {c.live ? (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/45 opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_rgba(34,197,94,0.7)]" />
                  </span>
                ) : null}
              </motion.li>
            ))}
          </ul>

          {/* Desktop: horizontal runway with spine */}
          <div className="relative mt-20 hidden lg:mt-24 lg:block">
            <div
              className="pointer-events-none absolute left-[8%] right-[8%] top-[2.125rem] h-px bg-gradient-to-r from-accent/55 via-white/12 to-white/[0.06]"
              aria-hidden
            />
            <ol className="relative grid grid-cols-5 gap-4">
              {ROADMAP_ITEMS.map((c) => (
                <motion.li
                  key={c.name}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-24px' }}
                  variants={fadeUp}
                  className="relative flex flex-col items-center text-center"
                >
                  <div
                    className={`relative z-10 flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full border-2 shadow-[0_0_0_6px_#08080a] ${
                      c.live
                        ? 'border-accent/60 bg-zinc-950 text-accent'
                        : 'border-white/12 bg-zinc-950 text-zinc-500'
                    }`}
                  >
                    <c.Icon className="h-7 w-7" strokeWidth={1.35} aria-hidden />
                  </div>
                  <h3 className="mt-8 font-display text-base font-semibold tracking-tight text-white xl:text-lg">
                    {c.name}
                  </h3>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    {c.live ? (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/45 opacity-50" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_rgba(34,197,94,0.75)]" />
                      </span>
                    ) : null}
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
                        c.live ? 'text-accent' : 'text-zinc-500'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section
        ref={capabilitiesSectionRef}
        id={CUSOWN_LANDING_SECTION_IDS.capabilities}
        className="relative scroll-mt-[calc(5.75rem+env(safe-area-inset-top,0px))] md:scroll-mt-28 border-t border-white/5 bg-zinc-950 py-28 sm:py-36"
      >
        <div className="pointer-events-none absolute inset-0 overflow-x-hidden" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_65%_at_25%_35%,rgba(34,197,94,0.1),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_65%_at_75%_55%,rgba(34,197,94,0.09),transparent_58%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0)_0%,rgba(9,9,11,0.4)_100%)]" />
          <motion.div
            className="absolute -left-[30%] top-[22%] h-[440px] w-[440px] rounded-full bg-accent/16 blur-[104px]"
            animate={{ opacity: [0.42, 0.62, 0.42], scale: [1, 1.04, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -right-[30%] bottom-[8%] h-[420px] w-[420px] rounded-full bg-accent/14 blur-[100px]"
            animate={{ opacity: [0.4, 0.58, 0.4], scale: [1, 1.04, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] xl:gap-20">
            <motion.aside
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              variants={capabilitiesIntroStagger}
              className="relative z-30 max-w-xl sticky top-[calc(4.75rem+env(safe-area-inset-top,0px))] self-start border-b border-white/10 bg-zinc-950/90 py-2 pb-6 backdrop-blur-xl sm:top-28 lg:border-b-0 lg:bg-transparent lg:py-0 lg:pb-0 lg:backdrop-blur-none xl:max-w-none"
            >
              <motion.p
                variants={capabilitiesIntroChild}
                className="mb-6 text-[11px] font-medium uppercase tracking-[0.28em] text-zinc-500"
              >
                Capabilities
              </motion.p>
              <motion.h2
                variants={capabilitiesIntroChild}
                className="font-display text-[2.125rem] font-semibold leading-[1.12] tracking-[-0.035em] text-white [text-shadow:0_2px_60px_rgba(0,0,0,0.35)] sm:text-4xl sm:leading-[1.08] lg:text-[2.75rem] lg:leading-[1.06]"
              >
                Everything you{' '}
                <span className="bg-gradient-to-r from-white via-emerald-50 to-accent bg-clip-text text-transparent">
                  expect
                </span>
                , nothing you{' '}
                <span className="bg-gradient-to-r from-white via-emerald-50 to-accent bg-clip-text text-transparent">
                  don&apos;t
                </span>
                .
              </motion.h2>
              <motion.div
                variants={capabilitiesIntroChild}
                className="mt-8 h-px max-w-xs bg-gradient-to-r from-accent/50 via-white/20 to-transparent sm:max-w-sm"
                aria-hidden
              />
              <motion.p
                variants={capabilitiesIntroChild}
                className="mt-8 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-600"
              >
                Product surface · {String(CAPABILITY_TOTAL_COUNT).padStart(2, '0')} modules
              </motion.p>
              <motion.p
                variants={capabilitiesIntroChild}
                className="mt-4 text-sm leading-relaxed text-zinc-500"
              >
                Scroll the runway, groups unpack how booking, reach, and operations layer together.
              </motion.p>
            </motion.aside>

            <div className="relative min-w-0 lg:mt-0 lg:pr-5 xl:pr-7">
              <div
                className="pointer-events-none absolute bottom-8 right-0 top-8 hidden w-1 overflow-hidden rounded-full bg-white/[0.07] lg:block"
                aria-hidden
              >
                <motion.div
                  className="w-full origin-top rounded-full bg-gradient-to-b from-accent via-emerald-400 to-accent/60"
                  style={{
                    scaleY: capabilitiesScrollProgress,
                    boxShadow: capabilitiesProgressShadow,
                  }}
                />
              </div>
              <motion.div
                className="pointer-events-none absolute -right-2 top-24 hidden h-32 w-32 rounded-full blur-3xl lg:block"
                style={{ backgroundColor: capabilitiesProgressGlow }}
                aria-hidden
              />

              <ul className="relative m-0 list-none border-t border-white/[0.07] p-0">
                {CAPABILITY_GROUPS.flatMap((group, groupIndex) => {
                  const header = (
                    <motion.li
                      key={`${group.label}-header`}
                      initial="hidden"
                      whileInView="show"
                      viewport={{ once: true, margin: '-12% 0px -8% 0px', amount: 0.2 }}
                      variants={capabilitiesRunwayItem}
                      className="border-b border-white/[0.07]"
                    >
                      <div className="py-8 sm:py-10 lg:py-11">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-accent">
                          {group.label}
                        </p>
                        <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
                          {group.blurb}
                        </p>
                      </div>
                    </motion.li>
                  );

                  let startIdx = 0;
                  for (let g = 0; g < groupIndex; g += 1) {
                    startIdx += CAPABILITY_GROUPS[g].items.length;
                  }

                  const rows = group.items.map((f, itemIndex) => {
                    const idx = startIdx + itemIndex + 1;
                    return (
                      <motion.li
                        key={f.title}
                        initial="hidden"
                        whileInView="show"
                        viewport={{
                          once: true,
                          margin: '-12% 0px -10% 0px',
                          amount: 0.35,
                        }}
                        variants={capabilitiesRunwayItem}
                        className="group relative border-b border-white/[0.07]"
                      >
                        <div className="relative overflow-hidden py-10 sm:py-12 lg:py-14">
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent/[0.06] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8 lg:gap-10">
                            <div className="flex items-center gap-4 sm:w-[7.5rem] sm:shrink-0 sm:flex-col sm:items-start sm:gap-3 lg:w-[8.5rem]">
                              <span className="font-display text-3xl tabular-nums leading-none tracking-tighter text-white/[0.12] transition-colors duration-300 group-hover:text-white/[0.22] sm:text-4xl">
                                {String(idx).padStart(2, '0')}
                              </span>
                              <motion.div
                                className="flex h-10 w-10 items-center justify-center sm:h-11 sm:w-11 lg:h-12 lg:w-12"
                                whileHover={{ scale: 1.08, rotate: -4 }}
                                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                              >
                                <f.Icon
                                  className="h-full w-full text-accent drop-shadow-[0_0_18px_rgba(34,197,94,0.4)] transition-[filter] duration-300 group-hover:drop-shadow-[0_0_28px_rgba(34,197,94,0.6)]"
                                  strokeWidth={1.35}
                                  aria-hidden
                                />
                              </motion.div>
                            </div>
                            <div className="min-w-0 flex-1 sm:pt-0 lg:pt-1">
                              <h3 className="font-display text-lg font-semibold tracking-tight text-white sm:text-xl lg:text-2xl">
                                {f.title}
                              </h3>
                              <p className="mt-2 max-w-lg text-[15px] leading-[1.75] text-zinc-400 sm:mt-3 sm:text-base">
                                {f.desc}
                              </p>
                            </div>
                          </div>
                          <div
                            className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 bg-gradient-to-r from-accent via-emerald-400/90 to-transparent transition-transform duration-500 ease-out group-hover:scale-x-100"
                            aria-hidden
                          />
                        </div>
                      </motion.li>
                    );
                  });

                  return [header, ...rows];
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <PricingSection />

      <section
        id={CUSOWN_LANDING_SECTION_IDS.process}
        className="relative scroll-mt-[calc(5.75rem+env(safe-area-inset-top,0px))] md:scroll-mt-28 border-t border-white/5 bg-zinc-950 py-28 sm:py-36"
      >
        <div className="pointer-events-none absolute inset-0 overflow-x-hidden" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_55%_at_50%_0%,rgba(34,197,94,0.08),transparent_55%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0)_0%,rgba(9,9,11,0.35)_100%)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            className="mx-auto max-w-3xl text-center lg:mx-0 lg:max-w-none lg:text-left"
          >
            <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.28em] text-zinc-500">
              Booking flows
            </p>
            <h2 className="font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-4xl sm:leading-[1.08] lg:text-[2.75rem]">
              One system,{' '}
              <span className="bg-gradient-to-r from-white via-emerald-50 to-accent bg-clip-text text-transparent">
                two parallel journeys
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg lg:mx-0">
              Owners run supply from the left; customers follow demand on the right. Both connect
              through the same live core, so openings, messages, and confirmations stay in sync.
            </p>
          </motion.div>

          <motion.div
            className="relative mt-14 sm:mt-16 lg:mt-20"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
          >
            <BookingFlowsDiagram />
          </motion.div>
        </div>
      </section>

      <LandingFaqSection />

      <section className="relative overflow-hidden border-t border-white/[0.06] bg-zinc-950 py-28 sm:py-36 lg:py-44">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-25%,rgba(34,197,94,0.14),transparent_58%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_35%_at_90%_85%,rgba(34,197,94,0.07),transparent_55%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0)_0%,rgba(9,9,11,0.55)_100%)]" />
        </div>
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-px w-[min(100%,42rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent"
          aria-hidden
        />

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8"
        >
          <p className="mx-auto mb-8 inline-flex items-center gap-4 font-mono text-[10px] font-semibold uppercase tracking-[0.38em] text-accent sm:mb-10 sm:text-[11px] sm:tracking-[0.42em]">
            <span
              className="h-px w-10 bg-gradient-to-r from-transparent to-accent sm:w-12"
              aria-hidden
            />
            CusOwn
            <span
              className="h-px w-10 bg-gradient-to-l from-transparent to-accent sm:w-12"
              aria-hidden
            />
          </p>

          <h2 className="font-display text-[clamp(1.875rem,4.8vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.038em] text-white">
            Start taking bookings the{' '}
            <span className="bg-gradient-to-r from-emerald-50 via-white to-accent bg-clip-text text-transparent">
              simpler way
            </span>
          </h2>

          <p className="mx-auto mt-7 max-w-lg text-[15px] leading-[1.65] text-zinc-500 sm:mt-8 sm:text-lg">
            No tools to learn. No friction to manage. Just a system that works.
          </p>

          <div className="mt-12 flex flex-col items-stretch justify-center gap-5 sm:mt-14 sm:flex-row sm:items-center sm:gap-6">
            <motion.button
              type="button"
              onClick={() => go(ROUTES.SELECT_ROLE('owner'))}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative w-full overflow-hidden rounded-full bg-accent px-10 py-4 text-[15px] font-semibold text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_32px_-6px_rgba(34,197,94,0.55)] transition-[box-shadow,transform] duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_48px_-8px_rgba(34,197,94,0.65)] sm:w-auto"
            >
              Start your business page
            </motion.button>
            <motion.button
              type="button"
              onClick={() => go(ROUTES.SELECT_ROLE('customer'))}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-[15px] font-semibold text-zinc-200 transition-colors hover:text-white sm:w-auto"
            >
              <span className="border-b border-transparent pb-0.5 transition-[border-color] group-hover:border-accent/80">
                Explore bookings
              </span>
              <ArrowRight
                className="h-4 w-4 text-accent/80 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2.25}
                aria-hidden
              />
            </motion.button>
          </div>

          <p className="mt-8 font-mono text-[10px] font-semibold uppercase tracking-[0.26em] text-zinc-600 sm:mt-9 sm:text-[11px]">
            Takes less than 5 minutes to get live
          </p>

          <div className="mx-auto mt-14 max-w-2xl sm:mt-16">
            <div
              className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.1] to-transparent"
              aria-hidden
            />
            <p className="mt-8 flex flex-col items-center gap-3 font-mono text-[10px] font-medium uppercase leading-relaxed tracking-[0.2em] text-zinc-600 sm:mt-9 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-0 sm:gap-y-2 sm:text-[11px] sm:tracking-[0.24em]">
              <span className="sm:px-4">No credit card required</span>
              <span className="hidden text-zinc-700 sm:inline sm:px-1" aria-hidden>
                ·
              </span>
              <span className="sm:px-4">{CUSOWN_PRICING.trialDays}-day trial, then paid plans</span>
              <span className="hidden text-zinc-700 sm:inline sm:px-1" aria-hidden>
                ·
              </span>
              <span className="sm:px-4">Works on any device</span>
            </p>
          </div>
        </motion.div>
      </section>

      <ForwardLookingStrip />

      <footer className="border-t border-white/[0.07] bg-zinc-950/90 py-12 pb-[max(2.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 text-center sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:text-left sm:px-6 lg:px-8">
          <div className="max-w-sm sm:max-w-none">
            <div className="font-display text-lg font-bold tracking-tight text-white sm:text-base">
              CUSOWN
            </div>
            <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 sm:text-xs">
              a Clykur product
            </div>
          </div>
          <div className="w-full border-t border-white/[0.06] pt-8 text-sm text-zinc-500 sm:w-auto sm:border-t-0 sm:pt-0 sm:text-right">
            <div className="font-medium text-zinc-400">Clykur</div>
            <div className="mt-1 text-[13px] leading-snug sm:text-sm">
              © {new Date().getFullYear()} CusOwn
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
