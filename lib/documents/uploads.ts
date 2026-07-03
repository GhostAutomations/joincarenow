/** Standard care-sector document uploads that can be requested in a workflow.
 *  Dropping one on a pipeline stage creates a document-upload task; dropping one
 *  in a Poppy box tells Poppy to review that uploaded document. */
export type UploadType = {
  key: string;
  label: string;
  body: string;
  /** A professional registration upload — the applicant enters a registration
   *  number and can optionally upload a photo of their card/certificate. */
  registration?: boolean;
  /** Needs a photo of both the front and the back (e.g. a DBS certificate). */
  twoSided?: boolean;
};

export const UPLOAD_TYPES: UploadType[] = [
  { key: "dbs", label: "DBS certificate", body: "Please upload a clear photo of BOTH the front and the back of your DBS certificate.", twoSided: true },
  {
    key: "registration",
    label: "Care worker registration",
    body: "Enter your registration number (Social Care Wales, SSSC or NISCC) and, if you have one, upload a photo of your registration card or certificate. If you don't have a card or certificate, tick the box and just enter your number.",
    registration: true,
  },
  { key: "right_to_work", label: "Right to Work / passport", body: "Please upload proof of your right to work in the UK (passport, or share code + photo ID)." },
  { key: "proof_of_address", label: "Proof of address", body: "Please upload a recent utility bill, bank statement or council tax letter (within the last 3 months)." },
  { key: "qualifications", label: "Qualifications / certificates", body: "Please upload certificates for any relevant qualifications (Care Certificate, NVQ/QCF, moving & handling, etc.)." },
  { key: "references", label: "References", body: "Please upload any written references you can provide." },
  { key: "driving_licence", label: "Driving licence", body: "Please upload a clear photo of your full UK driving licence." },
  { key: "cv", label: "CV", body: "Please upload your CV / full employment history." },
];

const BY_KEY = new Map(UPLOAD_TYPES.map((u) => [u.key, u]));
export const uploadType = (key: string): UploadType | undefined => BY_KEY.get(key);
export const uploadLabel = (key: string): string => BY_KEY.get(key)?.label ?? key;
export const isTwoSidedUpload = (key: string | null | undefined): boolean => (key ? BY_KEY.get(key)?.twoSided === true : false);
export const isRegistrationUpload = (key: string | null | undefined): boolean => (key ? BY_KEY.get(key)?.registration === true : false);
