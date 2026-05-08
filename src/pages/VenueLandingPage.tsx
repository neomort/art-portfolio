import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../components/Button';

const bullets = [
  'List your space',
  'Manage inbound interest',
  'Create & manage booking agreements',
  'Receive secure payments with prompt payout',
  'Respond to vendor reviews',
];

export default function VenueLandingPage() {
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
              Your commercial real estate is an expensive and valuable asset. Are you reaping its full benefit? Hosting another business in your underutilized space can help reduce costs while generating extra revenue and attracting foot traffic.              </p>
              <p>
                SplitSpace connects <strong>Venues</strong> with underutilized space and <strong>Vendors</strong> wanting to expand their physical presence together to create new opportunities through shared space.
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
            <h2 className="text-3xl font-bold text-[#EA6C56] font-unbounded mb-2">Spare space? Split it!</h2>
            <p className="text-maroon-700 mb-4 font-semibold text-xl md:text-xl">All-in-one Venue Management</p>
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
            <div className="rounded-2xl shadow-sm p-8 w-3/4 mx-auto bg-[#5B0D1B] text-white">
              <p className="text-lg opacity-90">SplitSpace Venues</p>
              <h3 className="mt-2 text-2xl md:text-xl ">Unused or Underutilized Spaces</h3>
              <p className="mt-2 text-xl md:text-xl ">Retail | Commercial | Unconventional</p>
              <p className="mt-2 text-xl md:text-xl ">Public, High Foot-Traffic Areas</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-[#FFF3F0] border-t border-maroon-100/50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-[#121826] mb-2">
            Ready to put your underutilized space to work?
          </h2>
          <p className="text-[#121826] mb-6">
            We’re onboarding Venues and Vendors now.
            Create an account, create your listing, and open your business up to new opportunities.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/signup">
              <Button className="bg-[#EA6C56] hover:bg-[#d45e4b] text-white">Create Venue Account</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
