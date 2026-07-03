// Form-builder field types that mirror the Workflow "Uploads" box, so a form can
// ask for a DBS, registration, proof of address, etc. Most are plain single-file
// uploads; DBS + driving licence capture both sides; registration captures a
// number plus an optional card photo.

export type UploadFieldMeta = {
  fieldType: string;   // the form field_type value
  label: string;       // shown in the builder's field-type list
  kind: "single" | "two_sided" | "registration";
};

export const UPLOAD_FIELD_TYPES: UploadFieldMeta[] = [
  { fieldType: "u_dbs", label: "DBS certificate (front & back)", kind: "two_sided" },
  { fieldType: "u_driving_licence", label: "Driving licence (front & back)", kind: "two_sided" },
  { fieldType: "u_registration", label: "Care worker registration", kind: "registration" },
  { fieldType: "u_right_to_work", label: "Right to Work / passport", kind: "single" },
  { fieldType: "u_proof_of_address", label: "Proof of address", kind: "single" },
  { fieldType: "u_qualifications", label: "Qualifications / certificates", kind: "single" },
  { fieldType: "u_references", label: "References (upload)", kind: "single" },
  { fieldType: "u_cv", label: "CV / employment history", kind: "single" },
];

const BY_TYPE = new Map(UPLOAD_FIELD_TYPES.map((u) => [u.fieldType, u]));

export const uploadFieldMeta = (fieldType: string): UploadFieldMeta | undefined => BY_TYPE.get(fieldType);
export const isUploadFieldType = (fieldType: string): boolean => BY_TYPE.has(fieldType);
export const isTwoSidedField = (fieldType: string): boolean => BY_TYPE.get(fieldType)?.kind === "two_sided";
export const isRegistrationField = (fieldType: string): boolean => BY_TYPE.get(fieldType)?.kind === "registration";
export const isSingleFileField = (fieldType: string): boolean => BY_TYPE.get(fieldType)?.kind === "single";
