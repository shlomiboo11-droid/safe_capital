/**
 * Sortable list helper — thin wrapper around SortableJS.
 *
 * Usage:
 *   initSortableList({
 *     containerSelector: '#agendaList',
 *     handleSelector: '.drag-handle',
 *     items: _agendaItems,               // in-memory array to reorder
 *     onReorder: (reordered) => { ... }  // called with new ordered array
 *   });
 *
 * Each item row must have data-idx="<index>" matching items[].
 */
(function (global) {
  'use strict';

  const _instances = new WeakMap();

  function debounce(fn, wait) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, arguments), wait);
    };
  }

  function initSortableList(opts) {
    const container = document.querySelector(opts.containerSelector);
    if (!container) return null;
    if (typeof Sortable === 'undefined') {
      console.warn('[sortable-list] SortableJS not loaded');
      return null;
    }

    // Destroy any existing instance on this container (re-render safe)
    const prev = _instances.get(container);
    if (prev) { try { prev.destroy(); } catch (e) {} }

    const debouncedReorder = opts.onReorder
      ? debounce(opts.onReorder, opts.debounceMs || 500)
      : null;

    const sortable = Sortable.create(container, {
      handle: opts.handleSelector || '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      chosenClass: 'sortable-chosen',
      forceFallback: false,
      onEnd: function (evt) {
        const oldIdx = evt.oldIndex;
        const newIdx = evt.newIndex;
        if (oldIdx === newIdx || oldIdx == null || newIdx == null) return;

        const items = opts.items;
        if (!Array.isArray(items)) return;

        const moved = items.splice(oldIdx, 1)[0];
        items.splice(newIdx, 0, moved);

        if (debouncedReorder) debouncedReorder(items);
      }
    });

    _instances.set(container, sortable);
    return sortable;
  }

  global.initSortableList = initSortableList;
})(window);
