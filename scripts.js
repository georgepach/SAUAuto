/* ══════════════════════════════════════════════
       GLOBAL STATE & LOGGING
     ══════════════════════════════════════════════ */
    let currentTab = 'autofill';
    let selectedAutoFillFiles = [];
    let importedExcelCardData = null;

    const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    let cols = [
      { label: 'Tested By', key: 'tested by', checked: true },
      { label: 'Approved By', key: 'approved by', checked: true },
      { label: 'Tester', key: 'tester', checked: false },
      { label: 'Test By', key: 'test by', checked: false },
      { label: 'Executed By', key: 'executed by', checked: false },
      { label: 'Verified By', key: 'verified by', checked: false },
    ];

    const configValues = {
      'tested by': '',
      'approved by': '',
      'tester': '',
      'test by': '',
      'executed by': '',
      'verified by': '',
    };

    function writeLog(msg, type = 'info') {
      const consoleBody = document.getElementById('consoleBody');
      const timeStr = new Date().toTimeString().split(' ')[0];
      const div = document.createElement('div');
      div.className = `console-log-line ${type}`;
      div.innerHTML = `<span class="timestamp">[${timeStr}]</span> <span>${msg}</span>`;
      consoleBody.appendChild(div);
      consoleBody.scrollTop = consoleBody.scrollHeight;
    }

    function triggerClear() {
      document.getElementById('consoleBody').innerHTML = '';
      document.getElementById('downloadArea').innerHTML = '';
      document.getElementById('downloadArea').classList.remove('visible');
      writeLog('Console output cleared.');
    }

    // Floating toast notifications
    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.style.background = '#2d2d2d';
      toast.style.border = '1px solid #3c3c3c';
      if (type === 'error') {
        toast.style.borderLeft = '3px solid #f44747';
      } else if (type === 'success') {
        toast.style.borderLeft = '3px solid #4ec9b0';
      } else {
        toast.style.borderLeft = '3px solid #007acc';
      }
      toast.style.color = '#d4d4d4';
      toast.style.padding = '10px 16px';
      toast.style.borderRadius = '4px';
      toast.style.fontSize = '12px';
      toast.style.display = 'flex';
      toast.style.alignItems = 'center';
      toast.style.gap = '8px';
      toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      toast.style.minWidth = '280px';
      toast.style.transition = 'all 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';

      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', type === 'error' ? 'alert-triangle' : (type === 'success' ? 'check-circle' : 'info'));
      icon.style.width = '16px';
      icon.style.height = '16px';
      if (type === 'error') icon.style.color = '#f44747';
      else if (type === 'success') icon.style.color = '#4ec9b0';
      else icon.style.color = '#007acc';

      const text = document.createElement('span');
      text.textContent = message;

      toast.appendChild(icon);
      toast.appendChild(text);
      container.appendChild(toast);
      
      lucide.createIcons();

      setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
      }, 50);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => {
          toast.remove();
        }, 300);
      }, 4000);
    }

    /* ══════════════════════════════════════════════
       TAB SYSTEM
     ══════════════════════════════════════════════ */
    function activateTab(tabId) {
      currentTab = tabId;

      // Reset active tab classes
      document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tree-item.indent').forEach(i => i.classList.remove('active'));

      // Activate selected
      if (tabId === 'autofill') {
        document.getElementById('tabAutoFill').classList.add('active');
        document.getElementById('panelAutoFill').classList.add('active');
        document.getElementById('treeAutoFill').classList.add('active');
      } else if (tabId === 'replacer') {
        document.getElementById('tabReplacer').classList.add('active');
        document.getElementById('panelReplacer').classList.add('active');
        document.getElementById('treeReplacer').classList.add('active');
      } else if (tabId === 'testcard') {
        document.getElementById('tabTestCard').classList.add('active');
        document.getElementById('panelTestCard').classList.add('active');
        document.getElementById('treeTestCard').classList.add('active');
      }
    }

    /* ══════════════════════════════════════════════
       INPUT VALIDATION & CHECKS
     ══════════════════════════════════════════════ */
    function validateExecutionInputs() {
      if (currentTab === 'autofill') {
        const hasFiles = selectedAutoFillFiles.length > 0;
        if (!hasFiles) {
          return { valid: false, message: 'Harap pilih/upload berkas pengujian terlebih dahulu.' };
        }
        
        // Validasi kolom target ditiadakan agar pengguna bisa mengeksekusi override status walau tanpa memilih kolom.
      } else if (currentTab === 'replacer') {
        const hasText = document.getElementById('replacerSourceText').value.trim() !== '';
        if (!hasText) {
          return { valid: false, message: 'Harap tempel data teks sumber (Source Text / Input).' };
        }
      } else if (currentTab === 'testcard') {
        const hasTester = document.getElementById('cardTesterName').value.trim() !== '';
        const hasData = importedExcelCardData !== null;
        if (!hasData) {
          return { valid: false, message: 'Harap unggah file Excel skenario pengujian.' };
        }
        if (!hasTester) {
          return { valid: false, message: 'Harap masukkan nama Tester (Tested By).' };
        }
      }
      return { valid: true };
    }

    /* ══════════════════════════════════════════════
       TAB 1: AUTO FILL TESTER LOGIC
     ═══════════════════════════════════════════════ */
    let previewExcelRows = null;
    let previewHeaderRowIndex = 0;
    let previewStartIdx = 0;

    function updateExcelPreviewLive() {
      if (!previewExcelRows || previewExcelRows.length === 0) return;

      const activeCols = cols.filter(c => c.checked);

      // Tampilkan 15 baris mulai dari 1 baris sebelum header utama
      const rowsToShow = previewExcelRows.slice(previewStartIdx, previewStartIdx + 15);

      let html = '<table style="width:100%; border-collapse:collapse; font-size:11px;">';
      rowsToShow.forEach((row, relativeIdx) => {
        const actualRowIdx = previewStartIdx + relativeIdx;
        const isHeader = actualRowIdx === previewHeaderRowIndex;

        // Cek apakah baris ini memuat target kolom yang dicentang
        const firstCellVal = String(row[0] || '').trim().toLowerCase();
        const matchedCol = activeCols.find(c => firstCellVal.includes(c.key));

        html += `<tr style="${isHeader ? 'background: var(--bg-sidebar); font-weight: bold; color: var(--text-bright);' : ''}">`;
        
        // Tampilkan minimal 10 kolom atau sepanjang baris yang ada
        const maxCols = Math.max(10, row.length);
        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
          const cellVal = row[colIdx];
          let displayVal = cellVal !== undefined ? cellVal : '';
          let isFilledPreview = false;

          // Jika baris ini merupakan target pengisian, dan sel setelah kolom A kosong/belum diisi
          if (matchedCol && colIdx > 0 && (cellVal === undefined || String(cellVal).trim() === '')) {
            const fillVal = configValues[matchedCol.key] || '';
            if (fillVal) {
              displayVal = fillVal;
              isFilledPreview = true;
            }
          }

          let style = 'border:1px solid var(--border); padding:6px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
          if (isFilledPreview) {
            style += 'background: rgba(78, 201, 176, 0.15); color: var(--green); border: 1.5px dashed var(--green); font-weight: 500;';
          }

          html += `<td style="${style}">${displayVal}</td>`;
        }
        
        html += '</tr>';
      });
      html += '</table>';

      document.getElementById('previewTableContent').innerHTML = html;
      document.getElementById('previewAreaAutoFill').classList.add('visible');
    }

    function renderConfigInputs() {
      const container = document.getElementById('dynamicConfigInputs');
      if (!container) return;
      container.innerHTML = '';

      const activeCols = cols.filter(c => c.checked);

      if (activeCols.length === 0) {
        container.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); padding: 8px 0; text-align: center;">Centang target kolom di sebelah kiri untuk mengisi nilai.</div>';
        return;
      }

      activeCols.forEach((col, idx) => {
        const key = col.key;
        if (configValues[key] === undefined) {
          configValues[key] = '';
        }

        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '10px';

        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.marginBottom = '4px';
        label.style.fontSize = '10.5px';
        label.style.fontWeight = '600';
        label.style.textTransform = 'uppercase';
        label.style.color = 'var(--text-muted)';
        label.textContent = col.label;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = configValues[key];
        input.placeholder = `Masukkan nilai untuk ${col.label}...`;
        input.addEventListener('input', (e) => {
          configValues[key] = e.target.value;
          updateExcelPreviewLive();
        });

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        container.appendChild(wrapper);
      });
    }

    function renderChips() {
      const container = document.getElementById('chipsContainer');
      container.innerHTML = '';
      cols.forEach((col, idx) => {
        const div = document.createElement('div');
        div.className = `chip ${col.checked ? 'active' : ''}`;
        div.innerHTML = `<input type="checkbox" ${col.checked ? 'checked' : ''} /> <span>${col.label}</span>`;
        div.querySelector('input').addEventListener('change', (e) => {
          col.checked = e.target.checked;
          div.classList.toggle('active', col.checked);
          renderConfigInputs(); // Live update configuration input fields!
          updateExcelPreviewLive(); // Live update preview table!
        });
        container.appendChild(div);
      });
    }
    renderChips();
    renderConfigInputs(); // Initial render config fields!

    function addCustomTargetColumn() {
      const input = document.getElementById('customColumnInput');
      const val = input.value.trim();
      if (!val) return;
      const key = val.toLowerCase();
      cols.push({ label: val, key: key, checked: true });
      configValues[key] = '';
      input.value = '';
      renderChips();
      renderConfigInputs();
      updateExcelPreviewLive();
      writeLog(`Custom column target added: "${val}"`);
    }

    function handleAutoFillFiles(files) {
      selectedAutoFillFiles = Array.from(files);
      updateSidebarFilesList(selectedAutoFillFiles);
      writeLog(`${selectedAutoFillFiles.length} file(s) selected for Auto Fill.`);

      if (selectedAutoFillFiles.length > 0) {
        const firstFile = selectedAutoFillFiles[0];
        if (firstFile.name.endsWith('.xlsx') || firstFile.name.endsWith('.xls')) {
          generateExcelPreview(firstFile);
        } else {
          document.getElementById('previewAreaAutoFill').classList.remove('visible');
        }
      }
    }

    function updateSidebarFilesList(files) {
      const area = document.getElementById('sidebarFilesArea');
      area.innerHTML = '';
      if (files.length === 0) {
        area.innerHTML = '<div style="padding: 4px 20px; font-size:11px; color: var(--text-muted);">No files loaded</div>';
        return;
      }
      files.forEach(f => {
        const item = document.createElement('div');
        item.className = 'tree-item indent';
        const isDoc = f.name.endsWith('.docx');
        const iconHtml = isDoc 
          ? '<i data-lucide="file-text" style="color:#569cd6; width:12px; height:12px;"></i>' 
          : '<i data-lucide="file-spreadsheet" style="color:#4ec9b0; width:12px; height:12px;"></i>';
        item.innerHTML = `<span class="icon">${iconHtml}</span> <span>${f.name}</span>`;
        area.appendChild(item);
      });
      lucide.createIcons();
    }

    async function generateExcelPreview(file) {
      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (allRows.length === 0) return;

        // Cari baris header utama (mengandung kata kunci 'NO' / 'Function')
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(allRows.length, 25); i++) {
          const row = allRows[i];
          if (row && row.some(cell => {
            const cellStr = String(cell || '').trim().toUpperCase();
            return cellStr === 'NO' || cellStr === 'NO TEST CASE' || cellStr === 'ID' || cellStr === 'FUNCTION';
          })) {
            headerRowIndex = i;
            break;
          }
        }

        previewExcelRows = allRows;
        previewHeaderRowIndex = headerRowIndex;
        previewStartIdx = Math.max(0, headerRowIndex - 1);

        updateExcelPreviewLive();
      } catch (err) {
        writeLog(`Error generating preview: ${err.message}`, 'error');
      }
    }

    /* ══════════════════════════════════════════════
       TAB 2: WORD REPLACER LOGIC
     ═══════════════════════════════════════════════ */
    function addReplacerRow() {
      const tbody = document.getElementById('rulesTableBody');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" placeholder="Cari..." /></td>
        <td><input type="text" placeholder="Ganti..." /></td>
        <td style="text-align:center;">
          <button class="action-btn-sm" onclick="this.closest('tr').remove()">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
      lucide.createIcons();
    }

    function processReplacements() {
      const sourceText = document.getElementById('replacerSourceText').value;
      if (!sourceText.trim()) return;

      const tbody = document.getElementById('rulesTableBody');
      const rows = tbody.querySelectorAll('tr');
      const rules = [];

      rows.forEach(r => {
        const inputs = r.querySelectorAll('input');
        const findVal = inputs[0].value;
        const replaceVal = inputs[1].value;
        if (findVal) {
          rules.push({ find: findVal, replace: replaceVal });
        }
      });

      let output = sourceText;

      const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      rules.forEach(rule => {
        const escapedFind = escapeRegExp(rule.find);
        const regex = new RegExp(escapedFind, 'g');
        output = output.replace(regex, rule.replace);
      });

      // Render highlight output (for HTML preview)
      let highlightedOutput = sourceText;
      rules.forEach(rule => {
        const escapedFind = escapeRegExp(rule.find);
        const regex = new RegExp(escapedFind, 'g');
        const span = `<span class="replace-highlight">${rule.replace}</span>`;
        highlightedOutput = highlightedOutput.replace(regex, span);
      });

      document.getElementById('replacerOutputText').innerHTML = highlightedOutput;
      document.getElementById('previewAreaReplacer').classList.add('visible');

      writeLog(`Executed ${rules.length} replacement rules successfully. Output ready.`, 'success');
      showToast('Word Replacement berhasil dieksekusi!', 'success');

      // Add single text download option
      const downloadArea = document.getElementById('downloadArea');
      downloadArea.classList.add('visible');
      downloadArea.innerHTML = '';

      const btn = document.createElement('button');
      btn.className = 'tb-btn primary';
      btn.innerHTML = '<i data-lucide="download"></i> Download Replaced Text (.txt)';
      btn.onclick = () => {
        const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'replaced_test_cases.txt';
        a.click();
      };
      downloadArea.appendChild(btn);
      lucide.createIcons();
    }

    function copyReplacerOutput() {
      const el = document.createElement('textarea');
      el.value = document.getElementById('replacerOutputText').innerText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      writeLog('Output text copied to clipboard.', 'success');
      showToast('Preview teks berhasil disalin ke clipboard.', 'success');
    }

    /* ══════════════════════════════════════════════
       TAB 3: TEST CARD GENERATOR LOGIC
     ═══════════════════════════════════════════════ */
    async function handleExcelCardImport(files) {
      if (files.length === 0) return;
      const file = files[0];
      document.getElementById('cardExcelNameDisplay').textContent = `📁 ${file.name}`;
      writeLog(`Reading Excel scenario file: ${file.name}`);

      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        // Membaca baris-baris data dari Excel
        const allData = XLSX.utils.sheet_to_json(ws, { header: 1 });
        let headerRowIndex = -1;
        let headers = [];

        // Menemukan baris header utama (seperti baris ke-11)
        for (let i = 0; i < allData.length; i++) {
          const row = allData[i];
          if (row && row.some(cell => {
            const cellStr = String(cell || '').trim().toUpperCase();
            return cellStr === 'NO' || cellStr === 'NO TEST CASE' || cellStr === 'ID' || cellStr === 'FUNCTION';
          })) {
            headerRowIndex = i;
            headers = row.map(h => String(h || '').trim());
            break;
          }
        }

        if (headerRowIndex === -1) {
          // Fallback parser jika tidak ditemukan header khusus
          importedExcelCardData = XLSX.utils.sheet_to_json(ws);
          writeLog('Warning: Kolom ID/NO tidak ditemukan. Menggunakan fallback parser.', 'warn');
        } else {
          const parsedRows = [];
          for (let i = headerRowIndex + 1; i < allData.length; i++) {
            const row = allData[i];
            if (!row || row.length === 0) continue;
            if (row.every(c => c === null || c === undefined || c === '')) continue; // Lewati baris kosong

            const obj = {};
            headers.forEach((header, colIdx) => {
              if (header) {
                obj[header] = row[colIdx] !== undefined ? row[colIdx] : '';
              }
            });
            parsedRows.push(obj);
          }
          importedExcelCardData = parsedRows;
        }

        writeLog(`Successfully loaded ${importedExcelCardData.length} test case rows from Excel.`, 'success');
        showToast(`Berhasil membaca ${importedExcelCardData.length} skenario pengujian!`, 'success');
        
        renderCardPreviews();
      } catch (err) {
        writeLog(`Failed to import Excel: ${err.message}`, 'error');
        showToast('Gagal memproses berkas Excel.', 'error');
        console.error(err);
      }
    }

    function renderCardPreviews() {
      const container = document.getElementById('cardsPreviewContainer');
      container.innerHTML = '';

      if (!importedExcelCardData || importedExcelCardData.length === 0) {
        container.innerHTML = `<div style="grid-column: span 3; text-align:center; padding: 20px; color: var(--text-muted);">Unggah file Excel dan isi nama Tester untuk memunculkan preview kartu test case</div>`;
        return;
      }

      const tester = document.getElementById('cardTesterName').value.trim() || 'Liam';
      const approved = document.getElementById('cardApprovedBy').value.trim() || 'TIM IT';

      importedExcelCardData.slice(0, 6).forEach(row => {
        // Normalise fields
        const testCaseNo = row['NO'] || row['No Test Case'] || row['ID'] || 'TCM001';
        const functionName = row['Function'] || row['Fungsi'] || 'Login';
        const scenario = row['Scenario'] || row['Skenario'] || '';
        const actualResult = row['Actual Result'] || row['Hasil Aktual'] || 'Sesuai';
        const status = row['Status'] || 'Success';
        const expectedResult = row['Expected Result'] || row['Hasil Ekspektasi'] || '';

        // Status / Result Formatting with Strikethrough for FAILED
        const isSuccess = String(status).toLowerCase().includes('success') || String(status).toLowerCase().includes('pass');
        const statusText = isSuccess ? 'SUCCESS / <s>FAILED</s>' : '<s>SUCCESS</s> / FAILED';
        const resultText = isSuccess ? 'PASSED / <s>FAILED</s>' : '<s>PASSED</s> / FAILED';

        const cardDiv = document.createElement('div');
        cardDiv.className = 'case-card';
        cardDiv.innerHTML = `
          <table class="case-card-table">
            <tr><td class="label-cell">No Test Case</td><td>${testCaseNo}</td></tr>
            <tr><td class="label-cell">Function</td><td>${functionName}</td></tr>
            <tr><td class="label-cell">Scenario</td><td>${scenario}</td></tr>
            <tr><td class="label-cell">Actual Result</td><td>${actualResult}</td></tr>
            <tr><td class="label-cell">Status</td><td class="strike-failed">${statusText}</td></tr>
            <tr><td class="label-cell">Expected Result</td><td>${expectedResult}</td></tr>
            <tr><td class="label-cell">Screen Capture</td><td><div class="capture-box"></div></td></tr>
            <tr><td class="label-cell">Result</td><td class="strike-failed">${resultText}</td></tr>
            <tr><td class="label-cell">Tested By</td><td>${tester}</td></tr>
            <tr><td class="label-cell">Approved By</td><td>${approved}</td></tr>
          </table>
        `;
        container.appendChild(cardDiv);
      });

      if (importedExcelCardData.length > 6) {
        const item = document.createElement('div');
        item.style.gridHeader = 'span 3';
        item.style.textAlign = 'center';
        item.style.fontSize = '11px';
        item.style.color = 'var(--text-muted)';
        item.textContent = `... dan ${importedExcelCardData.length - 6} kartu lainnya ...`;
        container.appendChild(item);
      }

      document.getElementById('previewAreaTestCard').classList.add('visible');
    }

    // Bind inputs to re-trigger card rendering
    document.getElementById('cardTesterName').addEventListener('input', renderCardPreviews);
    document.getElementById('cardApprovedBy').addEventListener('input', renderCardPreviews);

    /* ══════════════════════════════════════════════
       CORE EXECUTION TRIGGERS
     ═══════════════════════════════════════════════ */
    function triggerExecution() {
      const check = validateExecutionInputs();
      if (!check.valid) {
        writeLog(`Eksekusi gagal: ${check.message}`, 'error');
        showToast(check.message, 'error');
        return;
      }

      writeLog(`Executing action for module: ${currentTab.toUpperCase()}...`);
      if (currentTab === 'autofill') {
        processAutoFill();
      } else if (currentTab === 'replacer') {
        processReplacements();
      } else if (currentTab === 'testcard') {
        processExcelToTestCards();
      }
    }

    /* ══════════════════════════════════════════════
       AUTO FILL FUNCTIONALITY (EXCEL & WORD)
     ═══════════════════════════════════════════════ */
    async function processAutoFill() {
      const activeCols = cols.filter(c => c.checked);

      writeLog(`Running auto-fill task...`);

      let totalFilled = 0;
      let filesProcessed = 0;
      const downloadArea = document.getElementById('downloadArea');
      downloadArea.innerHTML = '';
      downloadArea.classList.add('visible');

      for (const file of selectedAutoFillFiles) {
        const isDocx = file.name.endsWith('.docx');
        const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

        try {
          if (isXlsx) {
            const result = await processXlsxFile(file, activeCols);
            totalFilled += result.filledCount;
            filesProcessed++;
            createDownloadButton(result.blob, file.name.replace(/\.(xlsx?)$/i, '_filled.xlsx'));
          } else if (isDocx) {
            const result = await processDocxFile(file, activeCols);
            totalFilled += result.filledCount;
            filesProcessed++;
            createDownloadButton(result.blob, file.name.replace(/\.(docx)$/i, '_filled.docx'));
          }
        } catch (err) {
          writeLog(`Error processing file ${file.name}: ${err.message}`, 'error');
          console.error(err);
        }
      }

      writeLog(`Auto Fill complete! Processed ${filesProcessed} files, filled ${totalFilled} empty cells.`, 'success');
      showToast(`Auto Fill sukses mengisi ${totalFilled} sel kosong!`, 'success');
    }

    async function processXlsxFile(file, activeCols) {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      let filledCount = 0;

      wb.SheetNames.forEach(shName => {
        const ws = wb.Sheets[shName];
        const ref = ws['!ref'];
        if (!ref) return;
        const range = XLSX.utils.decode_range(ref);

        for (let R = range.s.r; R <= range.e.r; R++) {
          const labelCell = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
          if (!labelCell) continue;
          const cellVal = String(labelCell.v || '').trim().toLowerCase();
          const match = activeCols.find(c => cellVal.includes(c.key));
          if (!match) continue;

          const fillVal = configValues[match.key] || '';

          for (let C = 1; C <= range.e.c; C++) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[addr];
            const isEmpty = !cell || cell.v === '' || cell.v === null || cell.v === undefined;
            if (isEmpty) {
              ws[addr] = { t: 's', v: fillVal };
              filledCount++;
            }
          }
        }
      });

      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      return { blob, filledCount };
    }

    async function processDocxFile(file, activeCols) {
      const data = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(data);
      const docXmlStr = await zip.file('word/document.xml').async('string');

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(docXmlStr, 'application/xml');
      let filledCount = 0;

      // Persiapan baca parameter UI Batch Status Override dari panel Auto Fill
      const overrideSelect = document.getElementById('cardStatusOverride');
      const overrideStatus = overrideSelect ? overrideSelect.value : 'AUTO';
      const rangeType = document.getElementById('cardRangeType') ? document.getElementById('cardRangeType').value : 'ALL';
      const startInput = document.getElementById('cardRangeStart');
      const endInput = document.getElementById('cardRangeEnd');
      const rangeStart = startInput && startInput.value ? parseInt(startInput.value) : 1;
      const rangeEnd = endInput && endInput.value ? parseInt(endInput.value) : 999999;
      
      let testCaseCounter = 0;

      const allTables = xmlDoc.getElementsByTagNameNS(WNS, 'tbl');
      for (let ti = 0; ti < allTables.length; ti++) {
        testCaseCounter++; // Setiap 1 tabel dianggap 1 Test Case
        const inRange = rangeType === 'ALL' || (testCaseCounter >= rangeStart && testCaseCounter <= rangeEnd);
        
        const allRows = allTables[ti].getElementsByTagNameNS(WNS, 'tr');
        for (let ri = 0; ri < allRows.length; ri++) {
          const row = allRows[ri];
          const cells = row.getElementsByTagNameNS(WNS, 'tc');
          
          // 1. Eksekusi Batch Status Override untuk sel yang mengandung teks success/failed
          for (let ci = 0; ci < cells.length; ci++) {
            const cellText = getCellText(cells[ci]).trim().replace(/\s+/g, ' '); // Normalisasi spasi
            
            if (cellText === 'SUCCESS / FAILED' || cellText === 'PASSED / FAILED') {
              if (inRange && overrideStatus !== 'AUTO') {
                // Jika STRIKE_FAILED, berarti yg sukses (isSuccess = true) -> FAILED dicoret.
                const isSuccess = overrideStatus === 'STRIKE_FAILED';
                setCellStrikethrough(cells[ci], cellText, isSuccess, xmlDoc);
                filledCount++; // Anggap ini sebuah "pengisian" agar dihitung
              }
            }
          }

          // 2. Eksekusi standar Auto Fill (mencari label & mengisi sel kosong)
          if (cells.length < 2) continue;

          const labelText = getCellText(cells[0]).toLowerCase();
          const match = activeCols.find(c => labelText.includes(c.key));
          if (!match) continue;

          const fillVal = configValues[match.key] || '';

          for (let ci = 1; ci < cells.length; ci++) {
            const cellText = getCellText(cells[ci]);
            if (!cellText) {
              setCellText(cells[ci], fillVal, xmlDoc);
              filledCount++;
            }
          }
        }
      }

      const serializer = new XMLSerializer();
      const newXml = serializer.serializeToString(xmlDoc);
      zip.file('word/document.xml', newXml);

      const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      return { blob, filledCount };
    }

    function getCellText(cell) {
      const texts = cell.getElementsByTagNameNS(WNS, 't');
      return Array.from(texts).map(t => t.textContent).join('').trim();
    }

    function setCellText(cell, text, xmlDoc) {
      const paras = cell.getElementsByTagNameNS(WNS, 'p');
      for (let p of paras) {
        const runs = Array.from(p.getElementsByTagNameNS(WNS, 'r'));
        runs.forEach(r => r.parentNode.removeChild(r));
      }

      let para = paras[0];
      if (!para) {
        para = xmlDoc.createElementNS(WNS, 'w:p');
        cell.appendChild(para);
      }

      const run = xmlDoc.createElementNS(WNS, 'w:r');
      const t = xmlDoc.createElementNS(WNS, 'w:t');
      t.setAttribute('xml:space', 'preserve');
      t.textContent = text;
      run.appendChild(t);
      para.appendChild(run);
    }

    function setCellStrikethrough(cell, originalText, isSuccess, xmlDoc) {
      const paras = cell.getElementsByTagNameNS(WNS, 'p');
      for (let p of paras) {
        const runs = Array.from(p.getElementsByTagNameNS(WNS, 'r'));
        runs.forEach(r => r.parentNode.removeChild(r));
      }

      let para = paras[0];
      if (!para) {
        para = xmlDoc.createElementNS(WNS, 'w:p');
        cell.appendChild(para);
      }
      
      const parts = originalText.split('/');
      const opt1 = parts[0].trim();
      const opt2 = parts[1].trim();

      const strike1 = isSuccess ? false : true;
      const strike2 = isSuccess ? true : false;
      const color1 = '000000'; // Tetap hitam sesuai permintaan pengguna
      const color2 = '000000'; // Tetap hitam sesuai permintaan pengguna

      const createRun = (text, strike, color) => {
        const r = xmlDoc.createElementNS(WNS, 'w:r');
        const rPr = xmlDoc.createElementNS(WNS, 'w:rPr');
        
        // Memaksa penggunaan font Calibri
        const rFonts = xmlDoc.createElementNS(WNS, 'w:rFonts');
        rFonts.setAttribute('w:ascii', 'Calibri');
        rFonts.setAttribute('w:hAnsi', 'Calibri');
        rFonts.setAttribute('w:cs', 'Calibri');
        rPr.appendChild(rFonts);
        
        if (strike) {
          const strikeNode = xmlDoc.createElementNS(WNS, 'w:strike');
          strikeNode.setAttribute('w:val', '1');
          rPr.appendChild(strikeNode);
        }
        const colorNode = xmlDoc.createElementNS(WNS, 'w:color');
        colorNode.setAttribute('w:val', color);
        rPr.appendChild(colorNode);
        
        const szNode = xmlDoc.createElementNS(WNS, 'w:sz');
        szNode.setAttribute('w:val', '24'); // Ubah dari 20 (10pt) menjadi 24 (12pt)
        rPr.appendChild(szNode);
        
        r.appendChild(rPr);
        
        const t = xmlDoc.createElementNS(WNS, 'w:t');
        t.setAttribute('xml:space', 'preserve');
        t.textContent = text;
        r.appendChild(t);
        
        return r;
      };

      para.appendChild(createRun(opt1, strike1, color1));
      para.appendChild(createRun(' / ', false, '000000'));
      para.appendChild(createRun(opt2, strike2, color2));
    }

    function createDownloadButton(blob, filename) {
      const container = document.getElementById('downloadArea');
      const btn = document.createElement('button');
      btn.className = 'tb-btn';
      btn.style.border = '1px solid var(--accent)';
      btn.style.background = 'rgba(0, 122, 204, 0.15)';
      btn.innerHTML = `<i data-lucide="download"></i> ${filename}`;
      btn.onclick = () => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      };
      container.appendChild(btn);
      lucide.createIcons();
    }

    /* ══════════════════════════════════════════════
       WORD TEST CARD GENERATION ENGINE (JSZIP)
     ═══════════════════════════════════════════════ */
    /**
     * 1. FUNGSI UTAMA: Memproses File Excel dan Mengonversinya ke Word (.docx)
     * Fungsi ini dipanggil saat tombol ekskusi (misal: triggerExecution) ditekan.
     * Membaca data dari SheetJS dan mengopernya ke generator XML Word.
     */
    async function processExcelToTestCards() {
      const fileInput = document.getElementById('fileInputExcelCard');
      const testerInput = document.getElementById('cardTesterName');
      const approvedInput = document.getElementById('cardApprovedBy');
      const consoleBody = document.getElementById('consoleBody');
      const downloadArea = document.getElementById('downloadArea');

      // Validasi input file
      if (!fileInput || fileInput.files.length === 0) {
        logToConsole("ERROR", "Silakan unggah file Excel skenario terlebih dahulu.");
        alert("File Excel belum diunggah!");
        return;
      }

      const file = fileInput.files[0];
      const testerName = testerInput ? testerInput.value.trim() : "Rieliams Vamkam";
      const approvedBy = approvedInput ? approvedInput.value.trim() : "TIM IT";

      logToConsole("INFO", `Memulai konversi berkas: ${file.name}...`);

      const reader = new FileReader();
      
      reader.onload = async function (e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Ambil sheet pertama dari file Excel
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Konversi data sheet menjadi objek JSON array
          const sheetData = XLSX.utils.sheet_to_json(worksheet);

          if (sheetData.length === 0) {
            logToConsole("WARNING", "File Excel kosong atau tidak memiliki baris data yang valid.");
            return;
          }

          logToConsole("INFO", `Berhasil mengekstrak ${sheetData.length} baris data test case.`);

          // Panggil fungsi generator Word menggunakan JSZip
          logToConsole("INFO", "Sedang menyusun komponen struktur tabel OpenXML Word...");
          const docxBlob = await generateTestCardDocument(sheetData, testerName, approvedBy);

          // Sediakan tombol unduh secara dinamis di area download strip UI
          if (downloadArea) {
            downloadArea.innerHTML = ""; // Bersihkan tombol lama
            downloadArea.classList.add('visible'); // pastikan strip unduhan terlihat
            
            const downloadBtn = document.createElement("a");
            downloadBtn.href = URL.createObjectURL(docxBlob);
            downloadBtn.download = `SIT_Report_${file.name.split('.')[0]}.docx`;
            downloadBtn.className = "tb-btn primary";
            downloadBtn.innerHTML = `<i data-lucide="download"></i> Download SIT Report DOCX`;
            
            downloadArea.appendChild(downloadBtn);
            // Re-render icon lucide jika diperlukan
            if (typeof lucide !== 'undefined') lucide.createIcons();
          }

          logToConsole("SUCCESS", "Proses konversi selesai! Silakan klik tombol download di bawah.");
          showToast("Konversi Berhasil! File Word siap diunduh.", "success");

        } catch (error) {
          console.error(error);
          logToConsole("ERROR", `Terjadi kegagalan sistem: ${error.message}`);
        }
      };

      reader.readAsArrayBuffer(file);
    }


    /**
     * 2. CORE CORE ENGINE: Generator Dokumen DOCX via XML OPC Menggunakan JSZip
     * Membentuk tabel berpasangan (Key-Value) dan layouting sel sesuai rujukan MySAU Mobile.
     */
    async function generateTestCardDocument(testCasesData, testerName, approverName) {
      const zip = new JSZip();

      // A. Definisikan susunan konten relasi tipe konten media ([Content_Types].xml)
      zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`);

      // B. Definisikan global relationships folder (_rels/.rels)
      zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`);

      // Ambil nilai UI untuk fitur Batch Override
      const overrideSelect = document.getElementById('cardStatusOverride');
      const overrideStatus = overrideSelect ? overrideSelect.value : 'AUTO';
      
      const rangeTypeSelect = document.getElementById('cardRangeType');
      const rangeType = rangeTypeSelect ? rangeTypeSelect.value : 'ALL';
      
      const startInput = document.getElementById('cardRangeStart');
      const endInput = document.getElementById('cardRangeEnd');
      const rangeStart = startInput && startInput.value ? parseInt(startInput.value) : 1;
      const rangeEnd = endInput && endInput.value ? parseInt(endInput.value) : 999999;

      // C. Bangun isi struktur tabel XML dinamis dengan looping array data
      let tableBlocksXml = "";

      testCasesData.forEach((tc, index) => {
        const rowNumber = index + 1; // Baris keberapa (1-based)
        
        // Normalisasi pencarian nama properti kolom dari Excel (Case-Insensitive & Fallback Value)
        const noTestCase = tc["No Test Case"] || tc["no_test_case"] || tc["NO"] || tc["ID"] || `TCM${String(rowNumber).padStart(3, '0')}`;
        const functionName = tc["Function"] || tc["function"] || tc["Fungsi"] || "General Function";
        const scenarioBody = tc["Scenario"] || tc["scenario"] || tc["Skenario"] || "User melakukan aktivitas pengujian pada sistem.";
        const actualResult = tc["Actual Result"] || tc["actual_result"] || tc["Hasil Aktual"] || "SUCCESS / FAILED";
        const statusVal = tc["Status"] || tc["status"] || "SUCCESS / FAILED";
        const expectedResult = tc["Expected Result"] || tc["expected_result"] || tc["Hasil Ekspektasi"] || "Sistem merespons sesuai kriteria ekspektasi.";
        const finalResult = tc["Result"] || tc["result"] || "PASSED / FAILED";

        // Status & Result formatted strikethrough check with Batch Override Logic
        const inRange = rangeType === 'ALL' || (rowNumber >= rangeStart && rowNumber <= rangeEnd);

        let isSuccess;
        if (inRange && overrideStatus === 'STRIKE_FAILED') {
          isSuccess = true;
        } else if (inRange && overrideStatus === 'STRIKE_SUCCESS') {
          isSuccess = false;
        } else {
          isSuccess = statusVal.toLowerCase().includes('success') || statusVal.toLowerCase().includes('pass') || finalResult.toLowerCase().includes('pass');
        }

        const strike1 = isSuccess ? '' : '<w:strike w:val="1"/>';
        const strike2 = isSuccess ? '<w:strike w:val="1"/>' : '';
        const color1 = '000000'; // Tetap hitam
        const color2 = '000000'; // Tetap hitam

        // XML block pembangun 1 buah tabel kartu uji terstruktur (10 baris inti)
        tableBlocksXml += `
        <w:tbl>
          <w:tblPr>
            <w:tblW w:w="5000" w:type="pct"/>
            <w:tblBorders>
              <w:top w:val="single" w:sz="6" w:space="0" w:color="CCCCCC"/>
              <w:left w:val="single" w:sz="6" w:space="0" w:color="CCCCCC"/>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CCCCCC"/>
              <w:right w:val="single" w:sz="6" w:space="0" w:color="CCCCCC"/>
              <w:insideH w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
              <w:insideV w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
            </w:tblBorders>
            <w:tblLayout w:type="fixed"/>
          </w:tblPr>
          <w:tblGrid>
            <w:gridCol w:w="2500"/>
            <w:gridCol w:w="6500"/>
          </w:tblGrid>
          
          <w:tr>
            <w:trPr><w:cantSplit/></w:trPr>
            <w:tc><w:tcPr><w:shd w:fill="F5F5F5"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>No Test Case</w:t></w:r></w:p></w:tc>
            <w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(noTestCase)}</w:t></w:r></w:p></w:tc>
          </w:tr>
          
          <w:tr>
            <w:trPr><w:cantSplit/></w:trPr>
            <w:tc><w:tcPr><w:shd w:fill="F5F5F5"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Function</w:t></w:r></w:p></w:tc>
            <w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(functionName)}</w:t></w:r></w:p></w:tc>
          </w:tr>
          
          <w:tr>
            <w:trPr><w:cantSplit/></w:trPr>
            <w:tc><w:tcPr><w:shd w:fill="F5F5F5"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Scenario</w:t></w:r></w:p></w:tc>
            <w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(scenarioBody)}</w:t></w:r></w:p></w:tc>
          </w:tr>
          
          <w:tr>
            <w:trPr><w:cantSplit/></w:trPr>
            <w:tc><w:tcPr><w:shd w:fill="F5F5F5"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Actual Result</w:t></w:r></w:p></w:tc>
            <w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(actualResult)}</w:t></w:r></w:p></w:tc>
          </w:tr>
          
          <w:tr>
            <w:trPr><w:cantSplit/></w:trPr>
            <w:tc><w:tcPr><w:shd w:fill="F5F5F5"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Status</w:t></w:r></w:p></w:tc>
            <w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p>
              <w:r><w:rPr>${strike1}<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:color w:val="${color1}"/><w:sz w:val="24"/></w:rPr><w:t>SUCCESS</w:t></w:r>
              <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:color w:val="000000"/><w:sz w:val="24"/></w:rPr><w:t> / </w:t></w:r>
              <w:r><w:rPr>${strike2}<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:color w:val="${color2}"/><w:sz w:val="24"/></w:rPr><w:t>FAILED</w:t></w:r>
            </w:p></w:tc>
          </w:tr>
          
          <w:tr>
            <w:trPr><w:cantSplit/></w:trPr>
            <w:tc><w:tcPr><w:shd w:fill="F5F5F5"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Expected Result</w:t></w:r></w:p></w:tc>
            <w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(expectedResult)}</w:t></w:r></w:p></w:tc>
          </w:tr>
          
          <w:tr>
            <w:trPr><w:cantSplit/></w:trPr>
            <w:tc><w:tcPr><w:shd w:fill="F5F5F5"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Screen Capture</w:t></w:r></w:p></w:tc>
            <w:tc>
              <w:tcPr><w:vAlign w:val="center"/></w:tcPr>
              <w:p>
                <w:pPr><w:spacing w:before="600" w:after="600"/><w:jc w:val="center"/></w:pPr>
                <w:r><w:rPr><w:i/><w:color w:val="999999"/><w:sz w:val="18"/></w:rPr><w:t>[ Tempatkan Screenshot Bukti Uji Di Sini ]</w:t></w:r>
              </w:p>
            </w:tc>
          </w:tr>
          
          <w:tr>
            <w:trPr><w:cantSplit/></w:trPr>
            <w:tc><w:tcPr><w:shd w:fill="F5F5F5"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Result</w:t></w:r></w:p></w:tc>
            <w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p>
              <w:r><w:rPr>${strike1}<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:color w:val="${color1}"/><w:sz w:val="24"/></w:rPr><w:t>PASSED</w:t></w:r>
              <w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:color w:val="000000"/><w:sz w:val="24"/></w:rPr><w:t> / </w:t></w:r>
              <w:r><w:rPr>${strike2}<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:color w:val="${color2}"/><w:sz w:val="24"/></w:rPr><w:t>FAILED</w:t></w:r>
            </w:p></w:tc>
          </w:tr>
          
          <w:tr>
            <w:trPr><w:cantSplit/></w:trPr>
            <w:tc><w:tcPr><w:shd w:fill="F5F5F5"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Tested By</w:t></w:r></w:p></w:tc>
            <w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(testerName)}</w:t></w:r></w:p></w:tc>
          </w:tr>
          
          <w:tr>
            <w:trPr><w:cantSplit/></w:trPr>
            <w:tc><w:tcPr><w:shd w:fill="F5F5F5"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Approved By</w:t></w:r></w:p></w:tc>
            <w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(approverName)}</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:p><w:pPr><w:spacing w:after="240"/></w:pPr></w:p>
        `;
        
        // Page Break for all except the last item
        if (index < testCasesData.length - 1) {
          tableBlocksXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        }
      });

      // D. Satukan seluruh blok tabel ke template induk document.xml
      const documentXmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
            <w:spacing w:after="360"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="32"/>
              <w:b/>
              <w:color w:val="114477"/>
            </w:rPr>
            <w:t>SYSTEM INTEGRATION TESTING (SIT) REPORT</w:t>
          </w:r>
        </w:p>
        ${tableBlocksXml}
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
        </w:sectPr>
      </w:body>
    </w:document>`;

      zip.file("word/document.xml", documentXmlContent);

      // E. Compile struktur berkas menjadi objek Blob siap unduh
      const wordBlob = await zip.generateAsync({ type: "blob" });
      return wordBlob;
    }


    /**
     * 3. HELPER FUNCTION: Sanitisasi String XML Konten
     * Berfungsi mencegah file rusak/corrupt apabila terdapat karakter khusus (&, <, >) di teks Excel.
     */
    function escapeXml(unsafeString) {
      if (typeof unsafeString !== 'string') unsafeString = String(unsafeString);
      return unsafeString.replace(/[<>&'"]/g, function (c) {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
          default: return c;
        }
      });
    }


    /**
     * 4. HELPER FUNCTION: Menampilkan Log Sistem ke Panel Konsol UI
     */
    function logToConsole(type, message) {
      const consoleBody = document.getElementById('consoleBody');
      if (!consoleBody) return;

      const now = new Date();
      const timestamp = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
      
      let colorClass = "text-muted";
      if (type === "SUCCESS") colorClass = "text-green";
      if (type === "ERROR") colorClass = "text-red";
      if (type === "WARNING") colorClass = "text-orange";

      const logLine = document.createElement('div');
      logLine.className = 'console-log-line';
      logLine.innerHTML = `<span class="timestamp">${timestamp}</span> <span class="${colorClass}"><strong>${type}:</strong> ${message}</span>`;
      
      consoleBody.appendChild(logLine);
      consoleBody.scrollTop = consoleBody.scrollHeight; // Auto-scroll ke bawah
    }

    // Settings Modal Logic
    function openSettingsModal() {
      document.getElementById('settingsModal').classList.add('visible');
    }

    function closeSettingsModal() {
      document.getElementById('settingsModal').classList.remove('visible');
    }

    // Fungsi utilitas UI untuk menyembunyikan/menampilkan input rentang angka
    function toggleRangeInputs() {
      const type = document.getElementById('cardRangeType').value;
      const container = document.getElementById('cardRangeInputs');
      if (type === 'CUSTOM') {
        container.style.display = 'flex';
      } else {
        container.style.display = 'none';
      }
    }

    // Initialize Lucide Icons on load
    document.addEventListener('DOMContentLoaded', () => {
      lucide.createIcons();

      // Setup Settings Sidebar tabs basic functionality
      const sidebarItems = document.querySelectorAll('.settings-menu li');
      const settingsTitle = document.querySelector('.settings-title');
      
      sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
          sidebarItems.forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          settingsTitle.textContent = item.textContent;
          // In a real app, this would switch the view in the right panel.
        });
      });

      // Close modal on click outside
      const settingsOverlay = document.getElementById('settingsModal');
      settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) {
          closeSettingsModal();
        }
      });
    });
