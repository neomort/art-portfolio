import React from 'react';

const Logo: React.FC = () => {
  const [src, setSrc] = React.useState<string>("/splitspace-logo.svg");

  return (
    <div className="flex items-center">
      <img
        src={src}
        alt="SplitSpace"
        className="h-8"
        onError={() => {
          if (src !== "/splitspace-logo.png") {
            setSrc("/splitspace-logo.png");
          }
        }}
      />
    </div>
  );
};

export default Logo;