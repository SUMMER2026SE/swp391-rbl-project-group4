'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/flashcardController');

// Học phần (sets)
router.get('/sets',                 requireAuth, c.listSets);
router.post('/sets',                requireAuth, c.createSet);
router.get('/sets/:id',             requireAuth, c.getSet);
router.put('/sets/:id',             requireAuth, c.updateSet);
router.delete('/sets/:id',          requireAuth, c.deleteSet);

// Tiến độ học
router.get('/sets/:id/progress',    requireAuth, c.getProgress);
router.put('/sets/:id/progress',    requireAuth, c.upsertProgress);
router.delete('/sets/:id/progress', requireAuth, c.resetProgress);

// Thư mục (folders)
router.get('/folders',                    requireAuth, c.listFolders);
router.post('/folders',                   requireAuth, c.createFolder);
router.get('/folders/:id',                requireAuth, c.getFolder);
router.put('/folders/:id',                requireAuth, c.updateFolder);
router.delete('/folders/:id',             requireAuth, c.deleteFolder);
router.post('/folders/:id/sets',          requireAuth, c.addSetToFolder);
router.delete('/folders/:id/sets/:setId', requireAuth, c.removeSetFromFolder);

module.exports = router;
