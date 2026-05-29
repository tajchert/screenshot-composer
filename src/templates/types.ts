export interface TemplateProps {
  width: number;
  height: number;
  copy: Record<string, string>;
  screenshotUrl: string;
  frame: {
    intrinsic: { width: number; height: number };
    screen: { x: number; y: number; width: number; height: number; radius: number };
    image: string;
    mask?: string;
  };
  layout: {
    tilt: { x: number; y: number; z: number };
    translate: { x: number; y: number };
    perspective: number;
  };
  theme: {
    fontFamily: string;
    palette: { fg: string; accent: string; muted: string };
    background: { type: 'solid' | 'gradient'; color?: string; direction?: number; stops?: string[] };
  };
}

export interface TemplateMeta {
  id: string;
  displayName: string;
  description: string;
  copyFields: { key: string; label: string; required: boolean }[];
}

export interface TemplateModule {
  meta: TemplateMeta;
  render: (props: TemplateProps) => string;
}
