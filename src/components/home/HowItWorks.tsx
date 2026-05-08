import React from 'react';
import { Building, ClipboardCheck, MapPinned, MessageCircleQuestion } from 'lucide-react';

const steps = [
  {
    title: 'Complete Your Profile',
    description: (
      <>
        <a href="/signup" className="underline text-coral-600 hover:text-coral-700">Create your account</a>
        {" "}and provide details about your business and the kinds of opportunities you are looking for.
      </>
    ),
    icon: <ClipboardCheck className="h-12 w-12" />,
    color: 'bg-peach-100 text-peach-600',
  },
  {
    title: 'Search For Space',
    description: 'Start your search, filtering by location, availability, square footage, price, property type, and amenities. Save a list of your favorites.',
    icon: <MapPinned className="h-12 w-12" />,
    color: 'bg-coral-100 text-coral-600',
  },
  {
    title: 'Inquire and Book',
    description: 'Open an inquiry, detailing your requirements, brand identity, and questions. Work out the details, finalize pricing, agree to terms, and submit payment. ',
    icon: <MessageCircleQuestion  className="h-12 w-12" />,
    color: 'bg-maroon-100 text-maroon-600',
  },
  {
    title: 'Move In & Start Up',
    description: 'Arrange a pre-move-in visit. Stay in touch with the venue host until your move in day. Enjoy a productive a new chapter in growing your business.',
    icon: <Building className="h-12 w-12" />,
    color: 'bg-peach-100 text-peach-600',
  },
];

const HowItWorks: React.FC = () => {
  return (
    <section className="py-24 bg-[#FEFAF8]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4 text-[#121826] font-display">
            How SplitSpace Works
          </h2>
          <p className="text-lg text-[#121826] max-w-4xl mx-auto">
          SplitSpace connects businesses that want to expand their physical presence with available underutilized commercial spaces for pop-ups and other short- and medium-term engagements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative group">
              {/* Step Number */}
              <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-[#EA6C56] text-white text-opacity-100 flex items-center justify-center font-bold z-10 font-display shadow-lg">
                {index + 1}
              </div>
              
              {/* Step Card */}
              <div className="bg-white rounded-2xl shadow-lg p-8 h-full transition-all duration-300 group-hover:transform group-hover:scale-[1.02] group-hover:shadow-xl border-2 border-maroon-100/30">
                <div className={`${step.color} p-3 rounded-xl inline-flex mb-6 transition-all duration-300 group-hover:scale-110`}>
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-maroon-800 font-display">{step.title}</h3>
                <p className="text-maroon-600">{step.description}</p>
              </div>
              
              {/* Connector (between cards) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 right-0 w-8 h-0.5 bg-red-400 transform translate-x-full">
                  <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-600"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;