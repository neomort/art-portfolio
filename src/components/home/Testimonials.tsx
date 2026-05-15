import React from 'react';
import { Star } from 'lucide-react';

const testimonials = [
  {
    id: 1,
    text: "Art Portfolio made it incredibly easy to discover unique artwork for my home. I found amazing pieces that I never would have discovered elsewhere.",
    author: "Sarah Johnson",
    position: "Art Collector",
    avatar: "https://images.pexels.com/photos/762020/pexels-photo-762020.jpeg?auto=compress&cs=tinysrgb&w=120",
    rating: 5,
  },
  {
    id: 2,
    text: "As an artist, Art Portfolio has helped me reach new collectors and sell my work. The platform is intuitive and their support is outstanding.",
    author: "Michael Chen",
    position: "Visual Artist",
    avatar: "https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=120",
    rating: 5,
  },
  {
    id: 3,
    text: "We needed artwork for our new office space, and Art Portfolio delivered. We found the perfect pieces that reflect our company's values.",
    author: "Priya Patel",
    position: "Interior Designer",
    avatar: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=120",
    rating: 4,
  },
];

const Testimonials: React.FC = () => {
  return (
    <section className="py-24 bg-[#FEFAF8]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4 text-[#121826] font-display">
            What Our Users Say
          </h2>
          <p className="text-lg text-[#121826] max-w-4xl mx-auto">
            Hear from art collectors and artists who have found success with Art Portfolio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div 
              key={testimonial.id} 
              className="group bg-white rounded-2xl p-8 shadow-lg border-2 border-maroon-100/30 transition-all duration-300 hover:transform hover:scale-[1.02] hover:shadow-xl"
            >
              {/* Rating Stars */}
              <div className="flex flex-row items-center space-x-1 mb-6 bg-peach-50 p-2 rounded-xl">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`shrink-0 h-5 w-5 transition-transform group-hover:scale-110 ${
                      i < testimonial.rating 
                        ? 'text-amber-500 fill-amber-500' 
                        : 'text-maroon-200'
                    }`} 
                  />
                ))}
              </div>
              
              {/* Testimonial Text */}
              <p className="text-maroon-700 mb-8 text-lg italic leading-relaxed">
                "{testimonial.text}"
              </p>
              
              {/* Author Info */}
              <div className="flex items-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full overflow-hidden ring-4 ring-maroon-100 transition-all duration-300 group-hover:ring-maroon-200">
                    <img 
                      src={testimonial.avatar} 
                      alt={testimonial.author} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-gradient-to-br from-maroon-500 to-maroon-600 rounded-full flex items-center justify-center text-white text-opacity-100 text-xs font-bold">
                    {testimonial.rating}
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="font-bold text-maroon-800 font-display">
                    {testimonial.author}
                  </h4>
                  <p className="text-maroon-500 text-sm">
                    {testimonial.position}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;