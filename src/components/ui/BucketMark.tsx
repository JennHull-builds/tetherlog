import type { CSSProperties, ReactNode } from "react";
import type { TriageBucket } from "../../types";

/**
 * The kit's two-colour categorical palette, one fill per group (D-041).
 * Do is blue, Wonder is pale blue, Drop is orange, Later is pale orange.
 * Wins are not a group: they keep the success green.
 *
 * Always a FILL with the kit's matching -text token on top. Never a text
 * colour on the page, because orange text on the light ground fails contrast.
 * Every mark is outlined in the border colour, which is the kit's rule for
 * chart marks and what keeps the pale fills above 3:1 against the page.
 */
const BUCKET_COLOUR: Record<TriageBucket, string> = {
  do: "chart-blue",
  wonder: "chart-blue-pale",
  drop: "chart-orange",
  later: "chart-orange-pale",
};

function bucketFill(bucket: TriageBucket): CSSProperties {
  const name = BUCKET_COLOUR[bucket];
  return {
    background: `var(--nil-color-${name})`,
    color: `var(--nil-color-${name}-text)`,
    border: "var(--nil-border-width) solid var(--nil-color-border)",
  };
}

export interface BucketMarkProps {
  bucket: TriageBucket;
  /** The words on the mark. The group's name is always in them: colour is never the only carrier. */
  children: ReactNode;
  id?: string;
}

/** A small filled label for one group, in the kit's label type. */
export function BucketMark({ bucket, children, id }: BucketMarkProps) {
  return (
    <span
      id={id}
      className="nil-label"
      data-bucket={bucket}
      style={{
        ...bucketFill(bucket),
        display: "inline-block",
        padding: "var(--nil-spacing-xs) var(--nil-spacing-sm)",
        borderRadius: "var(--nil-radius-default)",
        lineHeight: 1.45,
      }}
    >
      {children}
    </span>
  );
}
