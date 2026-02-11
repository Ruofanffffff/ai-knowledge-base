/**
 * Notes Service Module
 * 
 * Exports all note-related services and utilities.
 * Provides database access layer (DAL) for Note and Attachment models,
 * and tag extraction utilities.
 */

const noteDAL = require('./noteDAL');
const attachmentDAL = require('./attachmentDAL');
const tagExtractor = require('./tagExtractor');

module.exports = {
  // Note DAL
  ...noteDAL,
  
  // Attachment DAL
  ...attachmentDAL,
  
  // Tag Extractor
  ...tagExtractor,
  
  // Namespaced exports for clarity
  noteDAL,
  attachmentDAL,
  tagExtractor
};
