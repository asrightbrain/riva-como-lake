/* Mini runtime for the Riva prototype: holes {{a.b}}, <sc-if>, <sc-for>, onClick handlers, DCLogic with setState. */
(function () {
  'use strict';
  var HOLE = /\{\{\s*([^}]*?)\s*\}\}/g;
  var WHOLE = /^\{\{\s*([^}]*?)\s*\}\}$/;
  function lookup(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null' || path === 'undefined') return undefined;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.'), v = scope[parts[0]];
    for (var i = 1; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, p) { var v = lookup(p, scope); return v == null || v === false ? '' : String(v); });
  }
  var SKIP = { 'hint-placeholder-val': 1, 'hint-placeholder-count': 1, 'hint-size': 1 };
  function buildKids(node, scope, out) {
    Array.prototype.forEach.call(node.childNodes, function (c) { build(c, scope, out); });
  }
  function build(node, scope, out) {
    if (node.nodeType === 3) { out.push(document.createTextNode(interp(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();
    if (tag === 'sc-if') {
      var m = WHOLE.exec(node.getAttribute('value') || '');
      if (m && lookup(m[1], scope)) buildKids(node, scope, out);
      return;
    }
    if (tag === 'sc-for') {
      var lm = WHOLE.exec(node.getAttribute('list') || ''), as = node.getAttribute('as') || 'item';
      var list = (lm && lookup(lm[1], scope)) || [];
      list.forEach(function (item, i) {
        var s = Object.create(scope); s[as] = item; s.$index = i; buildKids(node, s, out);
      });
      return;
    }
    var ns = node.namespaceURI;
    var el = ns && ns !== 'http://www.w3.org/1999/xhtml' ? document.createElementNS(ns, node.localName) : document.createElement(node.localName);
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a], name = at.name, val = at.value;
      if (SKIP[name]) continue;
      var w = WHOLE.exec(val);
      if (/^on[A-Za-z]/.test(name)) {
        var fn = w ? lookup(w[1], scope) : null;
        if (typeof fn === 'function') el.addEventListener(name.slice(2).toLowerCase(), fn);
        continue;
      }
      var res = w ? lookup(w[1], scope) : (val.indexOf('{{') >= 0 ? interp(val, scope) : val);
      if (res == null || res === false) continue;
      if (res === true) res = '';
      el.setAttribute(name, String(res));
    }
    var buf = [];
    buildKids(node, scope, buf);
    buf.forEach(function (n) { el.appendChild(n); });
    out.push(el);
  }
  function render(tplNodes, vals, root) {
    var out = [];
    tplNodes.forEach(function (n) { build(n, vals, out); });
    root.replaceChildren.apply(root, out);
  }

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; this._mounted = false; }
    setState(p) {
      var patch = typeof p === 'function' ? p(this.state, this.props) : p;
      this.state = Object.assign({}, this.state, patch);
      if (this._mounted) this.forceUpdate();
    }
    forceUpdate() { if (this._rerender) this._rerender(); }
  }
  window.DCLogic = DCLogic;

  window.rivaMount = function (opts) {
    var tpl = document.getElementById('riva-template');
    var root = document.getElementById('riva-root');
    var tplNodes = Array.prototype.slice.call(tpl.content.childNodes);
    var inst = new opts.Component({});
    inst._rerender = function () { render(tplNodes, inst.renderVals(), root); };
    render(tplNodes, inst.renderVals(), root);
    inst._mounted = true;
    if (inst.componentDidMount) inst.componentDidMount();
    window.addEventListener('pagehide', function () { if (inst.componentWillUnmount) inst.componentWillUnmount(); });
  };
})();
