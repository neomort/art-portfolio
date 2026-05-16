import React from 'react';

const Logo: React.FC = () => {
  const [src, setSrc] = React.useState<string>("/logo.svg");

  return (
    <div className="flex items-center">
      <img
        src={src}
        alt="Art Portfolio"
        className="h-8"
        onError={() => {
          if (src !== "/logo.png") {
            setSrc("/logo.png");
          }
        }}
      />
    </div>
  );
};

export default Logo;