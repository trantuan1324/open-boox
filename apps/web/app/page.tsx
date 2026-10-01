import { apiPublic } from '@/lib/api/server';
import { loadLanding } from './_landing/data';
import { Cursor } from './_landing/motion/cursor';
import { LandingMotion } from './_landing/motion/landing-motion';
import { Banner } from './_landing/sections/banner';
import { CoverMarquee } from './_landing/sections/cover-marquee';
import { Hero } from './_landing/sections/hero';
import { Showcase } from './_landing/sections/showcase';
import { WordMarquee } from './_landing/sections/word-marquee';
import './landing.css';

export default async function HomePage() {
  const data = await loadLanding(apiPublic);
  return (
    <div className="obx-home">
      <LandingMotion />
      <Cursor />
      <Banner plans={data.plans} />
      <div className="obx-sheet obx-sheet--sky obx-sheet--hero">
        <Hero />
        <Showcase books={data.books} categories={data.categories} />
      </div>
      <WordMarquee />
      <CoverMarquee books={data.books} />
    </div>
  );
}
