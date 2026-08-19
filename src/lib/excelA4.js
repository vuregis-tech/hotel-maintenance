import * as XLSX from 'xlsx'
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'

// SheetJS เขียน <pageSetup> ไม่ได้ (community edition) จึงต้องแกะไฟล์ .xlsx
// แล้วแทรก XML ตั้งค่าหน้ากระดาษเข้าไปเอง — paperSize 9 = A4
const PAPER_A4 = 9

/**
 * เขียนไฟล์ Excel พร้อมตั้งค่าพิมพ์ขนาด A4 แล้วสั่งดาวน์โหลด
 * opts: { orientation: 'portrait'|'landscape', fitToWidth: number, freezeRows: number }
 * (freeze pane ก็เขียนเองเช่นกัน — SheetJS community ไม่รองรับ ws['!freeze'])
 */
export function writeXlsxA4(wb, filename, opts = {}) {
  const { orientation = 'landscape', fitToWidth = 1, freezeRows = 0 } = opts
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const files = unzipSync(new Uint8Array(buf))

  for (const path of Object.keys(files)) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) continue
    let xml = strFromU8(files[path])

    // fitToPage ต้องประกาศใน <sheetPr> และ sheetPr ต้องเป็น element แรกของ worksheet
    if (!xml.includes('<sheetPr')) {
      xml = xml.replace(/(<worksheet[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>')
    } else if (!xml.includes('<pageSetUpPr')) {
      xml = xml.includes('<sheetPr/>')
        ? xml.replace('<sheetPr/>', '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>')
        : xml.replace(/(<sheetPr[^>]*>)/, '$1<pageSetUpPr fitToPage="1"/>')
    }

    // ตรึงแถวหัวตารางให้ค้างไว้ตอนเลื่อนดูบนจอ
    if (freezeRows > 0 && !xml.includes('<pane ')) {
      const pane = `<pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}"`
        + ' activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>'
      xml = xml.replace(/<sheetView([^>]*)\/>/, `<sheetView$1>${pane}</sheetView>`)
      if (!xml.includes('<pane ')) {
        xml = xml.replace(/(<sheetView[^>]*>)/, `$1${pane}`)
      }
    }

    // ลำดับตาม schema: ... pageMargins → pageSetup → headerFooter
    const pageSetup = `<pageSetup paperSize="${PAPER_A4}" orientation="${orientation}"`
      + ` fitToWidth="${fitToWidth}" fitToHeight="0" horizontalDpi="300" verticalDpi="300"/>`
    if (xml.includes('<pageMargins')) {
      xml = xml.replace(/(<pageMargins[^>]*\/>)/, `$1${pageSetup}`)
    } else {
      xml = xml.replace(/<\/worksheet>/,
        '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>'
        + `${pageSetup}</worksheet>`)
    }
    files[path] = strToU8(xml)
  }

  const blob = new Blob([zipSync(files)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
