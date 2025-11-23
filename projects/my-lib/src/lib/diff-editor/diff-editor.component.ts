import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewEncapsulation
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export interface DiffConfig {
  oldText: string;
  newText: string;
  showLineNumbers?: boolean;
  colors?: {
    deleteBg?: string;
    insertBg?: string;
    updateBg?: string;
    equalBg?: string;
    wordDelBg?: string;
    wordDelColor?: string;
    wordInsBg?: string;
    wordInsColor?: string;
  };
}
export interface header{
  isHeader:boolean| true
  leftHeaderName?:string|'LeftSide'
    rightHeader?:string|'RightSide'

}
interface DiffRow {
  left: {
    lineNo: number | null;
    text: SafeHtml | string | null;
    type: string;
  };
  right: {
    lineNo: number | null;
    text: SafeHtml | string | null;
    type: string;
  };
}

@Component({
  selector: 'diff-editor',
  templateUrl: './diff-editor.component.html',
  styleUrls: ['./diff-editor.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class DiffEditorComponent implements OnChanges {

  @Input() config!: DiffConfig;
@Input() header!:header
  // internal reactive copies (editors bind here)
  oldText = '';
  newText = '';

  diffRows: DiffRow[] = [];
  showLineNumbers = true;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config']) {
      // copy values safely if provided
      this.oldText = this.config?.oldText ?? this.oldText;
      this.newText = this.config?.newText ?? this.newText;
      this.applyConfig();
    }
  }

  applyConfig() {
    this.showLineNumbers = this.config?.showLineNumbers ?? true;
    this.injectDynamicColors(this.config?.colors);
    this.generateDiff();
  }

  // inject theme CSS dynamically (allows color overrides)
  injectDynamicColors(colors?: any) {
    const c = colors ?? {};
const css = `


.diff-editor .equal {
  background: ${c.equalBg ?? '#ffffff'};
}

.diff-editor .delete {
  background: ${c.deleteBg ?? '#ffecec'};
  color: #b30000;
}


.diff-editor .insert {
  background: ${c.insertBg ?? '#eaffea'};
  color: #006400;
}
.diff-editor .update {
  background: ${c.updateBg ?? '#fff9cc'};
  color: #8a6d00;
}

/* WORD LEVEL COLORS */
.word-del {
  background: ${c.wordDelBg ?? '#ffcdcd'};
  color: ${c.wordDelColor ?? '#7a0000'};
  font-weight: 600;
}

.word-ins {
  background: ${c.wordInsBg ?? '#cdfcdc'};
  color: ${c.wordInsColor ?? '#006600'};
  font-weight: 600;
}

/* Row Hover Effect */
.diff-editor .row:hover {
  filter: brightness(0.98);
}
`;


    // remove previously injected style (if any) to avoid duplicates
    const existing = document.getElementById('diff-editor-theme');
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = 'diff-editor-theme';
    style.innerHTML = css;
    document.head.appendChild(style);
  }

  // called on editor input events
  generateDiff() {
    const oldLines = (this.oldText || '').split(/\r?\n/);
    const newLines = (this.newText || '').split(/\r?\n/);

    const ops = this.computeLcsDiff(oldLines, newLines);
    this.diffRows = this.convertOpsToRows(ops, oldLines, newLines);
  }

  // ---------- line-level LCS + heuristics ----------
  computeLcsDiff(a: string[], b: string[]) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const ops: any[] = [];
    let i = 0, j = 0;

    while (i < m && j < n) {
      // exact equal
      if (a[i] === b[j]) { ops.push({ type: 'equal', aIndex: i, bIndex: j }); i++; j++; continue; }

      // key-based quick match (before ':' or '=')
      const keyA = (a[i] || '').split(/[:=]/)[0].trim().toLowerCase();
      const keyB = (b[j] || '').split(/[:=]/)[0].trim().toLowerCase();
      if (keyA && keyA === keyB) {
        ops.push({ type: 'update', aIndex: i, bIndex: j });
        i++; j++; continue;
      }

      // word-similarity (LCS on words)
      const sim = this.wordSimilarity(a[i] || '', b[j] || '');
      if (sim >= 0.5) {
        ops.push({ type: 'update', aIndex: i, bIndex: j });
        i++; j++; continue;
      }

      // update via DP diagonal
      if (dp[i + 1][j + 1] >= dp[i + 1][j] && dp[i + 1][j + 1] >= dp[i][j + 1]) {
        // check shift: if a[i] matches better b[j+1], treat current b[j] as insert
        if (j + 1 < n && this.wordSimilarity(a[i], b[j + 1]) > this.wordSimilarity(a[i], b[j])) {
          ops.push({ type: 'insert', aIndex: -1, bIndex: j });
          j++; continue;
        }
        ops.push({ type: 'update', aIndex: i, bIndex: j });
        i++; j++; continue;
      }

      // if dp suggests delete
      if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'delete', aIndex: i, bIndex: -1 }); i++; continue; }

      // else insert
      ops.push({ type: 'insert', aIndex: -1, bIndex: j }); j++;
    }

    while (i < m) { ops.push({ type: 'delete', aIndex: i, bIndex: -1 }); i++; }
    while (j < n) { ops.push({ type: 'insert', aIndex: -1, bIndex: j }); j++; }

    return ops;
  }

  // word-level similarity using LCS on words
  wordSimilarity(a: string, b: string): number {
    const wa = (a || '').trim().split(/\s+/).filter(x => x.length>0);
    const wb = (b || '').trim().split(/\s+/).filter(x => x.length>0);
    if (wa.length === 0 && wb.length === 0) return 1;
    if (wa.length === 0 || wb.length === 0) return 0;

    const m = wa.length, n = wb.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        if (wa[i] === wb[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const lcs = dp[0][0];
    return lcs / Math.max(m, n);
  }

  // inline word diff for update (returns sanitized HTML)
  inlineDiff(oldLine: string, newLine: string) {
    const a = oldLine.split(/(\s+)/);
    const b = newLine.split(/(\s+)/);

    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    let i = 0, j = 0;
    let leftHtml = '', rightHtml = '';
    while (i < m && j < n) {
      if (a[i] === b[j]) { leftHtml += a[i]; rightHtml += b[j]; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { leftHtml += `<span class="word-del">${this.escapeHtml(a[i])}</span>`; i++; }
      else { rightHtml += `<span class="word-ins">${this.escapeHtml(b[j])}</span>`; j++; }
    }
    while (i < m) leftHtml += `<span class="word-del">${this.escapeHtml(a[i++])}</span>`;
    while (j < n) rightHtml += `<span class="word-ins">${this.escapeHtml(b[j++])}</span>`;

    return {
      leftHtml: this.sanitizer.bypassSecurityTrustHtml(leftHtml),
      rightHtml: this.sanitizer.bypassSecurityTrustHtml(rightHtml)
    };
  }

  // convert ops into display rows (pair deletes+inserts where reasonable)
  convertOpsToRows(ops: any[], oldLines: string[], newLines: string[]): DiffRow[] {
    const rows: DiffRow[] = [];
    let oldNo = 1, newNo = 1;
    let i = 0;

    while (i < ops.length) {
      const op = ops[i];

      if (op.type === 'equal') {
        rows.push({
          left: { lineNo: oldNo++, text: this.escapeAndPreserve(oldLines[op.aIndex]), type: 'equal' },
          right: { lineNo: newNo++, text: this.escapeAndPreserve(newLines[op.bIndex]), type: 'equal' }
        });
        i++; continue;
      }

      if (op.type === 'insert') {
        // consecutive inserts group
        while (i < ops.length && ops[i].type === 'insert') {
          const ins = ops[i];
          rows.push({
            left: { lineNo: null, text: null, type: 'insert' },
            right: { lineNo: newNo++, text: this.escapeAndPreserve(newLines[ins.bIndex]), type: 'insert' }
          });
          i++;
        }
        continue;
      }

      if (op.type === 'delete') {
        // collect deletes and following inserts to try pairing
        const delOps = [];
        const insOps = [];
        while (i < ops.length && ops[i].type === 'delete') delOps.push(ops[i++]);
        while (i < ops.length && ops[i].type === 'insert') insOps.push(ops[i++]);

        // pair by key if possible
        const usedIns = new Array(insOps.length).fill(false);
        for (let di = 0; di < delOps.length; di++) {
          const d = delOps[di];
          const dLine = (oldLines[d.aIndex] || '').trim();
          const dKey = dLine.split(/[:=]/)[0];
          let matched = -1;
          for (let ii = 0; ii < insOps.length; ii++) {
            if (usedIns[ii]) continue;
            const nLine = (newLines[insOps[ii].bIndex] || '').trim();
            const nKey = nLine.split(/[:=]/)[0];
            if (dKey && dKey === nKey) { matched = ii; break; }
          }
          if (matched >= 0) {
            usedIns[matched] = true;
            const ins = insOps[matched];
            const { leftHtml, rightHtml } = this.inlineDiff(oldLines[d.aIndex], newLines[ins.bIndex]);
            rows.push({
              left: { lineNo: oldNo++, text: leftHtml, type: 'update' },
              right: { lineNo: newNo++, text: rightHtml, type: 'update' }
            });
          } else {
            // no matching insert -> delete row
            rows.push({
              left: { lineNo: oldNo++, text: this.escapeAndPreserve(oldLines[d.aIndex]), type: 'delete' },
              right: { lineNo: null, text: null, type: 'delete' }
            });
          }
        }

        // remaining unmatched inserts
        for (let ii = 0; ii < insOps.length; ii++) {
          if (!usedIns[ii]) {
            const ins = insOps[ii];
            rows.push({
              left: { lineNo: null, text: null, type: 'insert' },
              right: { lineNo: newNo++, text: this.escapeAndPreserve(newLines[ins.bIndex]), type: 'insert' }
            });
          }
        }

        continue;
      }

      if (op.type === 'update') {
        const { leftHtml, rightHtml } = this.inlineDiff(oldLines[op.aIndex], newLines[op.bIndex]);
        rows.push({
          left: { lineNo: oldNo++, text: leftHtml, type: 'update' },
          right: { lineNo: newNo++, text: rightHtml, type: 'update' }
        });
        i++; continue;
      }

      // fallback safety
      i++;
    }

    return rows;
  }

  // small helpers
  escapeHtml(s: string) {
    return (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  escapeAndPreserve(s: string) {
    return this.sanitizer.bypassSecurityTrustHtml(this.escapeHtml(s ?? ''));
  }
onLeftEdit(i: number, event: any) {
  const newValue = event.target.value;

  const lineNo = this.diffRows[i].left.lineNo;
  if (!lineNo) return;

  let lines = this.config.oldText.split("\n");
  lines[lineNo - 1] = newValue;
  this.config.oldText = lines.join("\n");

  this.generateDiff();
}

onRightEdit(i: number, event: any) {
  const newValue = event.target.value;

  const lineNo = this.diffRows[i].right.lineNo;
  if (!lineNo) return;

  let lines = this.config.newText.split("\n");
  lines[lineNo - 1] = newValue;
  this.config.newText = lines.join("\n");

  this.generateDiff();
}



}
