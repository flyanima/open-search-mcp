declare module 'pdf-poppler' {
  export interface ConvertOptions {
    format?: 'jpeg' | 'png' | 'tiff' | 'ps' | 'eps' | 'svg';
    out_dir?: string;
    out_prefix?: string;
    page?: number;
    single_file?: boolean;
    print_command?: boolean;
  }

  export function convert(pdfPath: string, options: ConvertOptions): Promise<string[]>;
}
