/**
 * IIIF Linking API
 * ============================================================================
 * This section is still a work in progress. Its not clear what will be
 * normalized on the way into the redux state.
 *
 * - getSeeAlso
 * - getService
 * - getRelated
 * - getRendering
 * - getWithin
 * - getStartCanvas
 */
import memoize from 'lodash.memoize';

const preprocessLinkedEntities = (value, parent, key) => {
  switch (key) {
    case 'seeAlso':
    case 'service':
    case 'related':
    case 'rendering':
    case 'within':
    case 'startCanvas':
      return normalizeLinkedResources(value);
    default:
      return value;
  }
};

const normalizeLinkedResourceToObject = memoize(property => {
  if (!property) {
    return null;
  }
  if (typeof property === 'string') {
    return [{ '@id': property }];
  }
  if (Array.isArray(property)) {
    return null; // Invalid.
  }
  if (property['@value']) {
    // presentation 2.
    return [property];
  }
  return null;
});

const normalizeLinkedResources = memoize(property => {
  if (!property) {
    return [];
  }
  if (typeof property === 'string') {
    return [{ '@id': property }];
  }
  if (Array.isArray(property)) {
    return property
      .map(prop => normalizeLinkedResourceToObject(prop))
      .reduce((a, b) => a.concat(b), [])
      .filter(e => e);
  }
  return normalizeLinkedResourceToObject(property);
});

const getSeeAlso = resource => resource.seeAlso;

const getService = resource => resource.service;

const getRelated = resource => resource.related;

const getRendering = resource => resource.rendering;

const getWithin = resource => resource.within;

const getStartCanvas = resource => resource.startCanvas;

export { preprocessLinkedEntities, normalizeLinkedResources };