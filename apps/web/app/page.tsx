import { Cursor } from './_landing/motion/cursor';
import { LandingMotion } from './_landing/motion/landing-motion';
import './landing.css';

export default function HomePage() {
  return (
    <div className="obx-home">
      <LandingMotion />
      <Cursor />
    </div>
  );
}
