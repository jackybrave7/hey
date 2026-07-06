const chatImgDrafts   = new Map();  // convId -> array of {dataUrl, file, uploading?}
const chatFileDrafts  = new Map();  // convId -> { file, uploading? } | null
const chatVideoDrafts = new Map();  // convId -> { file, uploading? } | null
export { chatImgDrafts, chatFileDrafts, chatVideoDrafts };
