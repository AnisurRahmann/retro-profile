import type { ObjectLayout, PartNode } from "@/illustrations/compose";
import type { IllustrationPaths } from "@/schema";
import { Art } from "./Art";

function Node({ node, paths }: { node: PartNode; paths: IllustrationPaths }) {
  return (
    <g data-p={node.id} data-hidden={node.hidden ? "" : undefined} style={node.origin ? { transformOrigin: `${node.origin[0]}px ${node.origin[1]}px` } : undefined}>
      {node.name ? (
        <g transform={node.transform}>
          <Art paths={paths} name={node.name} />
        </g>
      ) : null}
      {node.children?.map((child) => <Node key={child.id} node={child} paths={paths} />)}
    </g>
  );
}

/** One composed object as inline SVG, in its final pose. Groups are found by `data-p`: see compose.ts. */
export function Parts({ layout, paths }: { layout: Pick<ObjectLayout, "width" | "height" | "nodes">; paths: IllustrationPaths }) {
  return (
    <svg className="ill" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
      {layout.nodes.map((node) => (
        <Node key={node.id} node={node} paths={paths} />
      ))}
    </svg>
  );
}
