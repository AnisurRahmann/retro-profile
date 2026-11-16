import { spriteHref, type ObjectLayout, type PartNode } from "@/illustrations/compose";

/**
 * A sprite reference. By default it is `data-href`: the inline script after the room (lib/boot.ts) turns it into `href`
 * right after the first paint, so the drawings never compete with the text and the fonts. `eager` writes `href` directly.
 */
export const spriteRef = (href: string, eager = false) => (eager ? { href } : { "data-href": href });

function Node({ node, asset, eager }: { node: PartNode; asset: string; eager: boolean }) {
  return (
    <g data-p={node.id} data-hidden={node.hidden ? "" : undefined} style={node.origin ? { transformOrigin: `${node.origin[0]}px ${node.origin[1]}px` } : undefined}>
      {node.name ? <use {...spriteRef(spriteHref(asset, node.name), eager)} transform={node.transform} /> : null}
      {node.children?.map((child) => <Node key={child.id} node={child} asset={asset} eager={eager} />)}
    </g>
  );
}

/**
 * One composed object as inline SVG, in its final pose. Groups are found by `data-p`: see compose.ts.
 * The groups are in the page, the traced paths are not: each part is a <use> into the object's sprite file,
 * so the document stays small and the drawings arrive after the text. Colours still come from the page's palette variables.
 * `eager` is for the copy inside <noscript>, which has no script to attach the sprites.
 */
export function Parts({ layout, eager = false }: { layout: Pick<ObjectLayout, "asset" | "width" | "height" | "nodes">; eager?: boolean }) {
  return (
    <svg className="ill" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
      {layout.nodes.map((node) => (
        <Node key={node.id} node={node} asset={layout.asset} eager={eager} />
      ))}
    </svg>
  );
}

/** The object twice: the live drawing, and the same final pose for a browser without JavaScript. */
export function LazyParts({ layout }: { layout: Pick<ObjectLayout, "asset" | "width" | "height" | "nodes"> }) {
  return (
    <>
      <Parts layout={layout} />
      <noscript>
        <Parts layout={layout} eager />
      </noscript>
    </>
  );
}
