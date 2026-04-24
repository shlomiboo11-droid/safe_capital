import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";
import { z } from "zod";

export const dealVideoSchema = z.object({
  dealName: z.string(),
  city: z.string(),
  roi: z.number(),
  purchasePrice: z.number(),
  arv: z.number(),
  beforeImage: z.string(),
  afterImage: z.string(),
});

type Props = z.infer<typeof dealVideoSchema>;

const NAVY = "#022445";
const MAROON = "#984349";
const CREAM = "#fbf9f6";

export const DealVideo: React.FC<Props> = ({
  dealName,
  city,
  roi,
  purchasePrice,
  arv,
  beforeImage,
  afterImage,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = spring({ frame, fps, config: { damping: 200 } });
  const titleY = interpolate(titleOpacity, [0, 1], [40, 0]);

  const beforeOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: "clamp",
  });
  const afterOpacity = interpolate(frame, [120, 140], [0, 1], {
    extrapolateRight: "clamp",
  });
  const afterScale = interpolate(frame, [120, 200], [1.05, 1], {
    extrapolateRight: "clamp",
  });

  const roiProgress = spring({
    frame: frame - 210,
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  const roiDisplay = Math.round(roi * roiProgress);

  const profit = arv - purchasePrice;

  return (
    <AbsoluteFill style={{ backgroundColor: CREAM, fontFamily: "Inter, Heebo, sans-serif" }}>
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            padding: 80,
          }}
        >
          <div style={{ fontSize: 40, color: MAROON, letterSpacing: 6, fontWeight: 700 }}>
            SAFE CAPITAL
          </div>
          <div style={{ fontSize: 140, color: NAVY, fontWeight: 800, marginTop: 40 }}>
            {dealName}
          </div>
          <div style={{ fontSize: 52, color: NAVY, opacity: 0.6, marginTop: 20 }}>
            {city}
          </div>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={90} durationInFrames={60}>
        <AbsoluteFill style={{ opacity: beforeOpacity }}>
          <Img src={beforeImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              top: 80,
              left: 80,
              padding: "20px 40px",
              backgroundColor: NAVY,
              color: CREAM,
              fontSize: 48,
              fontWeight: 700,
              borderRadius: 12,
            }}
          >
            BEFORE
          </div>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={150} durationInFrames={90}>
        <AbsoluteFill style={{ opacity: afterOpacity, transform: `scale(${afterScale})` }}>
          <Img src={afterImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              top: 80,
              left: 80,
              padding: "20px 40px",
              backgroundColor: MAROON,
              color: CREAM,
              fontSize: 48,
              fontWeight: 700,
              borderRadius: 12,
            }}
          >
            AFTER
          </div>
        </AbsoluteFill>
      </Sequence>

      <Sequence from={210}>
        <AbsoluteFill
          style={{
            backgroundColor: NAVY,
            justifyContent: "center",
            alignItems: "center",
            padding: 80,
          }}
        >
          <div style={{ fontSize: 48, color: CREAM, opacity: 0.6, marginBottom: 30 }}>
            ROI
          </div>
          <div style={{ fontSize: 280, color: MAROON, fontWeight: 800, lineHeight: 1 }}>
            {roiDisplay}%
          </div>
          <div
            style={{
              marginTop: 80,
              display: "flex",
              gap: 80,
              color: CREAM,
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 32, opacity: 0.6 }}>Purchase</div>
              <div style={{ fontSize: 56, fontWeight: 700 }}>
                ${(purchasePrice / 1000).toFixed(0)}K
              </div>
            </div>
            <div>
              <div style={{ fontSize: 32, opacity: 0.6 }}>ARV</div>
              <div style={{ fontSize: 56, fontWeight: 700 }}>
                ${(arv / 1000).toFixed(0)}K
              </div>
            </div>
            <div>
              <div style={{ fontSize: 32, opacity: 0.6 }}>Profit</div>
              <div style={{ fontSize: 56, fontWeight: 700, color: MAROON }}>
                ${(profit / 1000).toFixed(0)}K
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
