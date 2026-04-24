import { Composition } from "remotion";
import { DealVideo, dealVideoSchema } from "./DealVideo";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="DealVideo"
        component={DealVideo}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={dealVideoSchema}
        defaultProps={{
          dealName: "Oxmoore",
          city: "Birmingham, AL",
          roi: 22,
          purchasePrice: 145000,
          arv: 225000,
          beforeImage:
            "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1080",
          afterImage:
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1080",
        }}
      />
    </>
  );
};
