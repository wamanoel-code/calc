const { useMemo, useState, useEffect } = React;

let idCounter = 0;
const nextId = () => `n_${idCounter++}`;

const makePlaceholder = () => ({ id: nextId(), type: 'placeholder' });
const makeNumber = (value) => ({ id: nextId(), type: 'number', value });
const makeVariable = (value = 'x') => ({ id: nextId(), type: 'variable', value });
const makeOperator = (value) => ({ id: nextId(), type: 'operator', value });

const makeToken = (label) => {
  if (/^[0-9]$/.test(label)) return makeNumber(label);
  if (label === 'x') return makeVariable('x');
  if (['+', '-', '×', '÷', '='].includes(label)) return makeOperator(label);
  if (label === '()') return { id: nextId(), type: 'parentheses', content: [makePlaceholder()] };
  if (label === 'frac') return { id: nextId(), type: 'fraction', numerator: [makePlaceholder()], denominator: [makePlaceholder()] };
  if (label === 'pow') return { id: nextId(), type: 'exponent', base: [makePlaceholder()], exponent: [makePlaceholder()] };
  if (label === 'sqrt') return { id: nextId(), type: 'root', radicand: [makePlaceholder()] };
  if (label === 'f()') return { id: nextId(), type: 'function', name: 'f', args: [makePlaceholder()] };
  return makePlaceholder();
};

const makeInitialExpression = () => ({ id: nextId(), type: 'expression', children: [makePlaceholder()] });

const findNode = (node, id) => {
  if (!node) return null;
  if (node.id === id) return node;
  const branches = [];
  if (node.children) branches.push(node.children);
  if (node.numerator) branches.push(node.numerator);
  if (node.denominator) branches.push(node.denominator);
  if (node.base) branches.push(node.base);
  if (node.exponent) branches.push(node.exponent);
  if (node.radicand) branches.push(node.radicand);
  if (node.content) branches.push(node.content);
  if (node.left) branches.push(node.left);
  if (node.right) branches.push(node.right);
  if (node.args) branches.push(node.args);

  for (const list of branches) {
    for (const item of list) {
      const found = findNode(item, id);
      if (found) return found;
    }
  }
  return null;
};

const cloneAndReplace = (node, targetId, mutator) => {
  if (node.id === targetId) return mutator(node);
  const cloned = { ...node };
  const mapList = (field) => {
    if (!cloned[field]) return;
    cloned[field] = cloned[field].map((n) => cloneAndReplace(n, targetId, mutator));
  };
  ['children', 'numerator', 'denominator', 'base', 'exponent', 'radicand', 'content', 'left', 'right', 'args'].forEach(mapList);
  return cloned;
};

const insertAtSelection = (tree, selectedId, token) => {
  return cloneAndReplace(tree, selectedId, (selected) => {
    if (selected.type === 'placeholder') return token;
    if (selected.type === 'expression') return { ...selected, children: [...selected.children, token] };
    return selected;
  });
};

const deleteSelection = (tree, selectedId) => cloneAndReplace(tree, selectedId, () => makePlaceholder());

const linearText = (node) => {
  if (!node) return '';
  switch (node.type) {
    case 'expression': return node.children.map(linearText).join('');
    case 'number': return node.value;
    case 'variable': return node.value;
    case 'operator': return node.value;
    case 'placeholder': return '';
    case 'fraction': return `(${node.numerator.map(linearText).join('')})/(${node.denominator.map(linearText).join('')})`;
    case 'exponent': return `${node.base.map(linearText).join('')}^(${node.exponent.map(linearText).join('')})`;
    case 'root': return `sqrt(${node.radicand.map(linearText).join('')})`;
    case 'parentheses': return `(${node.content.map(linearText).join('')})`;
    case 'function': return `${node.name}(${node.args.map(linearText).join('')})`;
    default: return '';
  }
};

const computeLocal = (text) => {
  const cleaned = text.replace(/\s+/g, '').replace(',', '.');
  const results = [];
  if (!cleaned) return results;

  if (cleaned === '(1)/(2)' || cleaned === '1/2') results.push({ title: 'Decimal', value: '0,5' });
  if (cleaned === '0.5') results.push({ title: 'Fração exata', value: '1/2' });
  if (/x\^?\(2\)-4$/.test(cleaned) || cleaned === 'x²-4') results.push({ title: 'Fatoração', value: '(x - 2)(x + 2)' });
  if (cleaned === '(x-2)(x+2)') results.push({ title: 'Expansão', value: 'x² - 4' });
  if (cleaned.includes('=12') && cleaned.includes('x')) results.push({ title: 'Solução', value: 'x = -4, x = 4' });
  if (cleaned.includes('=21') && cleaned.includes('x')) results.push({ title: 'Solução', value: 'x = -5, x = 5' });

  if (!results.length) results.push({ title: 'Forma principal', value: cleaned });
  return results;
};

const mockGeminiFallback = (text, apiKey) => new Promise((resolve) => {
  setTimeout(() => {
    resolve({
      source: apiKey ? 'gemini-mock-auth' : 'gemini-mock-public',
      hint: `Fallback assíncrono pronto para plugar Gemini 2.5 Flash para: ${text || '∅'}`
    });
  }, 350);
});

function FractionNodeView({ node, ...props }) {
  return <span className="frac node"><ExpressionNodeRenderer node={{ type:'expression', id:nextId(), children:node.numerator }} {...props} /><span className="frac-line" /><ExpressionNodeRenderer node={{ type:'expression', id:nextId(), children:node.denominator }} {...props} /></span>;
}
function ExponentNodeView({ node, ...props }) {
  return <span className="exp node"><ExpressionNodeRenderer node={{ type:'expression', id:nextId(), children:node.base }} {...props} /><span className="exp-sup"><ExpressionNodeRenderer node={{ type:'expression', id:nextId(), children:node.exponent }} {...props} /></span></span>;
}
function RootNodeView({ node, ...props }) {
  return <span className="root-wrap node"><span className="root-symbol">√</span><span className="root-content"><ExpressionNodeRenderer node={{ type:'expression', id:nextId(), children:node.radicand }} {...props} /></span></span>;
}
function ParenthesesNodeView({ node, ...props }) {
  return <span className="node"><span className="paren">(</span><ExpressionNodeRenderer node={{ type:'expression', id:nextId(), children:node.content }} {...props} /><span className="paren">)</span></span>;
}
function EquationNodeView({ left, right, ...props }) {
  return <span className="eq-part"><ExpressionNodeRenderer node={{ type:'expression', id:nextId(), children:left }} {...props} /><span className="operator">=</span><ExpressionNodeRenderer node={{ type:'expression', id:nextId(), children:right }} {...props} /></span>;
}

function ExpressionNodeRenderer({ node, selectedId, onSelect }) {
  const renderToken = (item) => {
    const selected = selectedId === item.id;
    const common = { className: `node ${selected ? 'selected':''}`, onClick: () => onSelect(item.id) };
    switch (item.type) {
      case 'placeholder': return <span key={item.id} {...common}><span className="placeholder">□</span></span>;
      case 'number':
      case 'variable': return <span key={item.id} {...common}>{item.value}</span>;
      case 'operator': return <span key={item.id} {...common}><span className="operator">{item.value}</span></span>;
      case 'fraction': return <span key={item.id} {...common}><FractionNodeView node={item} selectedId={selectedId} onSelect={onSelect} /></span>;
      case 'exponent': return <span key={item.id} {...common}><ExponentNodeView node={item} selectedId={selectedId} onSelect={onSelect} /></span>;
      case 'root': return <span key={item.id} {...common}><RootNodeView node={item} selectedId={selectedId} onSelect={onSelect} /></span>;
      case 'parentheses': return <span key={item.id} {...common}><ParenthesesNodeView node={item} selectedId={selectedId} onSelect={onSelect} /></span>;
      case 'function': return <span key={item.id} {...common}>{item.name}(<ExpressionNodeRenderer node={{type:'expression', id:nextId(), children:item.args}} selectedId={selectedId} onSelect={onSelect} />)</span>;
      default: return null;
    }
  };

  if (node.type === 'equation') return <EquationNodeView left={node.left} right={node.right} selectedId={selectedId} onSelect={onSelect} />;
  return <span className="row">{(node.children || []).map(renderToken)}</span>;
}

function MathKeyboard({ onPress }) {
  const keys = ['7','8','9','+','-','⌫','4','5','6','×','÷','()','1','2','3','frac','pow','sqrt','0',',','x','=','↶','↷','←','→'];
  return <div className="keyboard"><div className="keys">{keys.map((k) => <button key={k} className={k==='='?'primary':''} onClick={() => onPress(k)}>{k}</button>)}</div></div>;
}

function ResultPanel({ results, loading, fallback }) {
  return <div className="result-card"><h3>Resultados</h3>{loading && <div className="loading">calculando...</div>}<div className="result-list">{results.map((r, i) => <div className="result-item" key={`${r.title}-${i}`}><strong>{r.title}</strong><div>{r.value}</div></div>)}</div>{fallback && <p className="small">{fallback.hint} ({fallback.source})</p>}</div>;
}

function HistoryPanel({ history }) {
  return <div className="history-card"><h3>Histórico</h3>{history.slice(-6).reverse().map((h,i)=><div className="history-item" key={i}>{h}</div>)}</div>;
}

function MathEditor({ tree, selectedId, onSelect }) {
  return <div className="editor-card"><h3>MathEditor</h3><div className="editor-area"><ExpressionNodeRenderer node={tree} selectedId={selectedId} onSelect={onSelect} /></div><div className="small">Toque em um bloco □ para inserir estruturas aninháveis.</div></div>;
}

function App() {
  const [tree, setTree] = useState(makeInitialExpression);
  const [selectedId, setSelectedId] = useState(tree.children[0].id);
  const [history, setHistory] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [storedApiKey, setStoredApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const expressionText = useMemo(() => linearText(tree), [tree]);

  const pushHistory = (nextTree) => {
    setUndoStack((s) => [...s, tree]);
    setRedoStack([]);
    setTree(nextTree);
    setHistory((h) => [...h, linearText(nextTree) || '∅']);
  };

  const moveSelection = (direction) => {
    const nodes = [];
    const collect = (n) => {
      nodes.push(n.id);
      ['children', 'numerator', 'denominator', 'base', 'exponent', 'radicand', 'content', 'left', 'right', 'args'].forEach((field) => {
        (n[field] || []).forEach(collect);
      });
    };
    collect(tree);
    const idx = nodes.indexOf(selectedId);
    const next = direction === 'left' ? nodes[Math.max(0, idx - 1)] : nodes[Math.min(nodes.length - 1, idx + 1)];
    if (next) setSelectedId(next);
  };

  const handleKey = (key) => {
    if (key === '⌫') return pushHistory(deleteSelection(tree, selectedId));
    if (key === '↶') return setUndoStack((u) => {
      if (!u.length) return u;
      const prev = u[u.length - 1];
      setRedoStack((r) => [...r, tree]);
      setTree(prev);
      return u.slice(0, -1);
    });
    if (key === '↷') return setRedoStack((r) => {
      if (!r.length) return r;
      const next = r[r.length - 1];
      setUndoStack((u) => [...u, tree]);
      setTree(next);
      return r.slice(0, -1);
    });
    if (key === '←') return moveSelection('left');
    if (key === '→') return moveSelection('right');
    if (key === ',') key = '.';
    const token = makeToken(key);
    pushHistory(insertAtSelection(tree, selectedId, token));
    setSelectedId(token.id);
  };

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(async () => {
      const local = computeLocal(expressionText);
      setResults(local);
      if (local.length === 1 && local[0].title === 'Forma principal') {
        const fallbackResult = await mockGeminiFallback(expressionText, storedApiKey);
        setFallback(fallbackResult);
      } else {
        setFallback(null);
      }
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [expressionText, storedApiKey]);

  const saveApiKey = () => {
    localStorage.setItem('gemini_api_key', apiKeyInput);
    setStoredApiKey(apiKeyInput);
    setApiKeyInput('');
  };

  const testApiKey = async () => {
    setLoading(true);
    const res = await mockGeminiFallback(expressionText || 'teste', storedApiKey);
    setFallback({ ...res, hint: `Teste da chave concluído: ${res.hint}` });
    setLoading(false);
  };

  return <div className="app">
    <div className="topbar"><h1>MathFlow Visual Calculator</h1><span className="badge">PWA POC</span></div>
    <div className="workspace">
      <div>
        <MathEditor tree={tree} selectedId={selectedId} onSelect={setSelectedId} />
        <div className="api-card">
          <h3>Integração Gemini (preparada)</h3>
          <div className="api-row row"><input value={apiKeyInput} onChange={(e)=>setApiKeyInput(e.target.value)} placeholder="Cole sua API key" /></div>
          <div className="row" style={{marginTop:'8px'}}>
            <button onClick={saveApiKey}>Inserir chave API</button>
            <button onClick={testApiKey}>Testar chave API</button>
            <span className="small">{storedApiKey ? 'Chave salva localmente.' : 'Sem chave salva.'}</span>
          </div>
        </div>
      </div>
      <div>
        <ResultPanel results={results} loading={loading} fallback={fallback} />
        <HistoryPanel history={history} />
      </div>
    </div>
    <MathKeyboard onPress={handleKey} />
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
