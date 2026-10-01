import { apiPublic, getCurrentUser } from '@/lib/api/server';
import { loadLanding, pickFeaturedBook } from './_landing/data';
import { Cursor } from './_landing/motion/cursor';
import { LandingMotion } from './_landing/motion/landing-motion';
import { Banner } from './_landing/sections/banner';
import { CoverMarquee } from './_landing/sections/cover-marquee';
import { Features } from './_landing/sections/features';
import { Hero } from './_landing/sections/hero';
import { Nav } from './_landing/sections/nav';
import { Plans } from './_landing/sections/plans';
import { Showcase } from './_landing/sections/showcase';
import { Statement } from './_landing/sections/statement';
import { WordMarquee } from './_landing/sections/word-marquee';
import './landing.css';

export default async function HomePage() {
  const [user, data] = await Promise.all([getCurrentUser(), loadLanding(apiPublic)]);
  return (
    <div className="obx-home">
      <LandingMotion />
      <Cursor />
      <Banner plans={data.plans} />
      <Nav user={user} />
      <div className="obx-sheet obx-sheet--sky obx-sheet--hero">
        <Hero />
        <Showcase books={data.books} categories={data.categories} />
      </div>
      <Features plans={data.plans} />
      <Statement book={pickFeaturedBook(data.books)} />
      <WordMarquee />
      <Plans plans={data.plans} />
      <CoverMarquee books={data.books} />
    </div>
  );
}
