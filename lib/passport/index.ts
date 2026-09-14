export type {
  IndianPassportFields,
  IndianPassportExtraction,
  PassportCaptureMode,
  PassportFlowStage,
} from './types';
export { indianPassportFieldsSchema, isReviewComplete } from './schema';
export {
  extractIndianPassport,
  detectMrzRegion,
  findTd3MrzLines,
  parseAndValidateMrz,
  parseTd3Manually,
  correctMrzOcrArtifacts,
  extractMrzPairFromText,
  extractParentsPositional,
  classifyPages,
  isPassportMrzLine,
  validateTd3,
  td3CompositeCheckDigit,
  scoreMrzResult,
  mrzCheckDigit,
  repairWithCheckDigit,
  collectDates,
  inferDates,
  issueDateFromExpiry,
  mergeBackPageFields,
  extractVisualZoneNames,
  extractVisualZoneIdentity,
  mrzDateToIso,
  parseLooseDateToIso,
  ocrText,
  IndianPassportError,
  type Td3Validation,
} from './extractIndianPassport';
export {
  pdfPagesToCanvases,
  rasterizePdfPages,
  pdfPageCount,
  isPdfFile,
  canvasToBlob,
  MAX_PDF_PAGES,
  type RasterizedPage,
} from './pdfToImage';
export {
  findMrzBands,
  mrzBandScore,
  mrzRegion,
  type MrzBandCandidate,
} from './mrzLocate';
export { guessOrientation, orientPage } from './orientation';
export {
  choosePagesToPromote,
  rankBackPageCandidates,
  scoreBackPageCandidate,
  textLayerSignals,
} from './pageSelect';
export { selectCandidatePages, type CandidatePage } from './pipeline';
export { createPassportOcr, MRZ_WHITELIST, type PassportOcr } from './ocr';
export {
  extractBackPageDetails,
  hasBackPageEvidence,
  looksLikeFrontPage,
  type BackPageDetails,
  type BackPageOptions,
} from './backPage';
export { findDocumentRegions, normalizeDocumentPages } from './documentRegion';
