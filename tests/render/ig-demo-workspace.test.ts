import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import IgDemoWorkspace from '../../app/components/IgDemoWorkspace.tsx';
test('customer panel is absent without availability and trusted owner scope',()=>{
 assert.equal(renderToStaticMarkup(createElement(IgDemoWorkspace,{contextKey:'1'})),'');
 assert.equal(renderToStaticMarkup(createElement(IgDemoWorkspace,{available:true,contextKey:'1'})),'');
});
test('configured private panel still requires explicit browser opt-in and contains no credential form',()=>{
 const html=renderToStaticMarkup(createElement(IgDemoWorkspace,{available:true,ownerScope:'test',contextKey:'1'}));
 assert.ok(html.includes('Enable this session'));assert.ok(html.includes('type="checkbox"'));assert.equal(html.includes('checked=""'),false);assert.equal(html.includes('IG DEMO connection'),false);assert.equal(html.includes('type="password"'),false);
});
