import type { SVGProps } from "react";

interface ListClockIconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  size?: number | string;
}

export function ListClockIcon({ size = 24, ...props }: ListClockIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fill="currentColor"
        d="M674.88 325.76a302.528 302.528 0 1 1 0 605.12 302.528 302.528 0 0 1 0-605.056zM302.528 768a46.528 46.528 0 0 1 0 93.12H139.648a46.528 46.528 0 0 1 0-93.12h162.88z m372.352-349.12a209.472 209.472 0 1 0 0 418.944 209.472 209.472 0 0 0 0-418.944z m0 59.52c18.176 0 33.088 13.824 34.752 31.552l0.192 3.392v92.16l98.688 42.816c16.64 7.232 24.832 25.856 19.328 42.752l-1.216 3.2a34.944 34.944 0 0 1-42.752 19.264l-3.2-1.152L640 651.264V513.344c0-19.328 15.616-34.944 34.88-34.944z m-395.584-12.928a46.528 46.528 0 1 1 0 93.056H139.648a46.528 46.528 0 0 1 0-93.056h139.648z m512-302.592a46.528 46.528 0 0 1 0 93.12H139.648a46.528 46.528 0 0 1 0-93.12h651.648z"
      />
    </svg>
  );
}
