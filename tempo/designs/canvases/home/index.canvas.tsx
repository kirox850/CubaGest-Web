// @tempo-home — Tempo home canvas (the workspace Run button opens this). Managed marker; do not remove.
//
// One storyboard rendering your app's home route ("/"). Run (workspace header)
// opens this canvas beside your app's dev-server logs. Set the app dev command
// (set_app_dev_command) so the "/" route renders here.

import { Canvas, RouteStoryboard } from "tempo-sdk/canvas";
import { defineAsset } from "tempo-sdk/assets";
import { BrandLogo, IPhoneMockup } from "../../../../src/screens/Landing";
import Icon from "../../../../src/components/shared/Icon";
import { Storyboard as TempoCanvasStoryboard } from "tempo-sdk/canvas";

export default function HomeCanvas() {
  return (
    <Canvas name="Home" backgroundColor={"oklch(0.968 0.0007 0)"}>
      <RouteStoryboard
        id="Home"
        name="Home (/)"
        route="http://localhost:5173/"
        layout={{ x: -540, y: 16, width: 2202, height: 7749 }}
      />
    </Canvas>
  );
}

defineAsset(BrandLogo, {
  libraries: ["CubaGest UI"],
  usageInstructions: "CubaGest brand mark for navigation and footer surfaces; use this instead of duplicating the logo image or fallback treatment.",
});

defineAsset(IPhoneMockup, {
  libraries: ["CubaGest UI"],
  usageInstructions: "Marketing product mockup for landing-page hero sections; use it to present an app screenshot inside a phone frame, not as an interactive device.",
});

defineAsset(Icon, {
  libraries: ["CubaGest UI"],
  usageInstructions: "Shared icon vocabulary for CubaGest product and marketing surfaces; use an existing icon name instead of introducing a one-off SVG.",
  variants: {
    Status: { props: { name: "check" } },
    Sales: { props: { name: "pos" } },
    Inventory: { props: { name: "inventario" } },
  },
});
