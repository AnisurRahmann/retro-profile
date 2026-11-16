import { characterLayout } from "@/illustrations/compose";
import { a01b } from "@/illustrations/generated/a01b";
import { Art, at } from "./Art";

/**
 * A01, built from the whole-pose sheet (a01b): the puppet sheet could not be rigged, see docs/DECISIONS.md.
 * All three poses are in the markup, the idle pose is the one shown. The runtime swaps poses without tweening.
 */
export function CharacterObject() {
  const layout = characterLayout();
  return (
    <svg className="ill" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
      {layout.poses.map((pose) => (
        <g key={pose.pose} data-ch={pose.pose}>
          <g transform={at(pose)}>
            <g data-ch-body="" style={{ transformOrigin: pose.origin }}>
              <Art paths={a01b} name={pose.name} />
            </g>
          </g>
        </g>
      ))}
      <g data-ch="puffs">
        {layout.puffs.map((puff) => (
          <g key={puff.name} transform={at(puff)}>
            <Art paths={a01b} name={puff.name} />
          </g>
        ))}
      </g>
    </svg>
  );
}
