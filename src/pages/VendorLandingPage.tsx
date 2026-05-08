import { Link } from 'react-router-dom';
import { Star, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/Button';

const bullets = [
  'Search available listings',
  'Coordinate with Venue hosts via internal messaging',
  'Receive and approve booking terms',
  'Make secure payment',
  'Post reviews of venues',
];

export default function VendorLandingPage() {
  return (
    <div className="bg-[#FEFAF8]">
      {/* Hero */}
      <section className="pt-28 pb-3">
        <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#121826] font-unbounded mb-4">
              Join the Retail Revolution
            </h1>
            <div className="text-xl md:text-2xl text-[#121826] mb-6 max-w-prose space-y-4">
              <p>
                SplitSpace is an online marketplace that helps small businesses discover, book, and manage
                short‑term and on‑demand commercial retail spaces.
              </p>
              <p>
                Many growing businesses want to expand their footprint or make the digital‑to‑physical transition.
                The main barrier is the complexity and expense of long‑term commercial leases.
              </p>
              <p>
                SplitSpace connects <strong>Venues</strong> with existing, underutilized space and <strong>Vendors</strong> wanting to expand their physical presence together to create new opportunities through shared space.
              </p>
            </div>
          </div>
          <div className="relative">
            <img
              src="/vendor-hero.jpg"
              alt="Example retail space"
              className="rounded-2xl shadow-xl border border-maroon-100/50 w-3/4 mx-auto object-cover"
            />
          </div>
        </div>
      </section>

      

      {/* Easy Entry list + Testimonial */}
      <section className="py-10">
        <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-10 items-start">
          <div className="bg-white rounded-2xl shadow-sm border border-maroon-100/40 p-6">
            <h2 className="text-3xl font-bold text-[#EA6C56] font-unbounded mb-2">Need space? Split it!</h2>
            <p className="text-maroon-700 mb-4 font-semibold text-xl md:text-xl">Easy Entry for Vendor Brands</p>
            <ul className="space-y-3">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-[#121826]">
                  <CheckCircle2 className="h-5 w-5 text-[#EA6C56] mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="bg-white rounded-2xl shadow-sm border border-maroon-100/40 p-8 w-3/4 mx-auto">
              <blockquote className="max-w-none">
                <p className="text-[#121826] text-lg md:text-xl leading-relaxed">
                  “While my e‑commerce business was growing, I wanted to test selling in a physical store for a short
                  period of time. I found SplitSpace easy to facilitate finding and booking a short‑term rental space.”
                </p>
              </blockquote>
              <div className="mt-5 flex items-center gap-3">
                <img src="/kimr-testimonial.jpeg" alt="Kim R. headshot" className="h-10 w-10 rounded-full object-cover ring-2 ring-maroon-100" />
                <div>
                  <p className="font-semibold text-[#121826]">Kim R. <span className="font-normal"></span></p>
                  <div className="flex text-[#EA6C56]" aria-hidden="true">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      

      {/* CTA */}
      <section className="py-12 bg-[#FFF3F0] border-t border-maroon-100/50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-[#121826] mb-2">
            Ready to reimagine your retail experience?
          </h2>
          <p className="text-[#121826] mb-6">
            We’re onboarding Venues and Vendors now.
            View listings and start enjoying shared spaces today.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/properties">
              <Button className="bg-[#EA6C56] hover:bg-[#d45e4b] text-white">View Listings</Button>
            </Link>
            <Link to="/signup">
              <Button variant="secondary">Create Vendor Account</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
