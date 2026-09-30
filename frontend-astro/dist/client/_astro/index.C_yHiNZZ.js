import{a as h}from"./index.DK-fsZOb.js";var x={exports:{}},f={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var y;function O(){if(y)return f;y=1;var m=h(),s=Symbol.for("react.element"),e=Symbol.for("react.fragment"),r=Object.prototype.hasOwnProperty,t=m.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,o={key:!0,ref:!0,__self:!0,__source:!0};function a(p,u,d){var i,_={},R=null,v=null;d!==void 0&&(R=""+d),u.key!==void 0&&(R=""+u.key),u.ref!==void 0&&(v=u.ref);for(i in u)r.call(u,i)&&!o.hasOwnProperty(i)&&(_[i]=u[i]);if(p&&p.defaultProps)for(i in u=p.defaultProps,u)_[i]===void 0&&(_[i]=u[i]);return{$$typeof:s,type:p,key:R,ref:v,props:_,_owner:t.current}}return f.Fragment=e,f.jsx=a,f.jsxs=a,f}var E;function b(){return E||(E=1,x.exports=O()),x.exports}var S=b();let n=[],l=0;const c=4;let g=m=>{let s=[],e={get(){return e.lc||e.listen(()=>{})(),e.value},lc:0,listen(r){return e.lc=s.push(r),()=>{for(let o=l+c;o<n.length;)n[o]===r?n.splice(o,c):o+=c;let t=s.indexOf(r);~t&&(s.splice(t,1),--e.lc||e.off())}},notify(r,t){let o=!n.length;for(let a of s)n.push(a,e.value,r,t);if(o){for(l=0;l<n.length;l+=c)n[l](n[l+1],n[l+2],n[l+3]);n.length=0}},off(){},set(r){let t=e.value;t!==r&&(e.value=r,e.notify(t))},subscribe(r){let t=e.listen(r);return r(e.value),t},value:m};return e};export{g as a,S as j};
