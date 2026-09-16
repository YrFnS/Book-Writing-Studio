import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import JSZip from 'jszip';
import { Book, Chapter, Page } from '../types';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, filename.endsWith('.txt') ? filename : `${filename}.txt`);
}

export function exportMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, filename.endsWith('.md') ? filename : `${filename}.md`);
}

export async function exportDocx(filename: string, book: Book, target: 'page' | 'chapter' | 'book', page?: Page, chapter?: Chapter) {
  const docParagraphs: Paragraph[] = [];

  // Book title and subtitle
  docParagraphs.push(
    new Paragraph({
      text: book.title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    })
  );

  if (book.subtitle) {
    docParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: book.subtitle, italics: true, size: 28 })],
        spacing: { after: 400 },
      })
    );
  }

  if (target === 'page' && page) {
    docParagraphs.push(
      new Paragraph({
        text: page.title,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 200 },
      })
    );
    const paragraphs = page.content.split('\n\n');
    for (const p of paragraphs) {
      if (p.trim()) {
        docParagraphs.push(
          new Paragraph({
            children: [new TextRun(p.trim())],
            spacing: { line: 360, after: 180 },
          })
        );
      }
    }
  } else if (target === 'chapter' && chapter) {
    docParagraphs.push(
      new Paragraph({
        text: chapter.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
      })
    );
    for (const pg of chapter.pages) {
      docParagraphs.push(
        new Paragraph({
          text: pg.title,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 150 },
        })
      );
      const paragraphs = pg.content.split('\n\n');
      for (const p of paragraphs) {
        if (p.trim()) {
          docParagraphs.push(
            new Paragraph({
              children: [new TextRun(p.trim())],
              spacing: { line: 360, after: 180 },
            })
          );
        }
      }
    }
  } else {
    // Full book
    for (const volume of book.volumes) {
      docParagraphs.push(
        new Paragraph({
          text: volume.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 250 },
        })
      );

      for (const ch of volume.chapters) {
        docParagraphs.push(
          new Paragraph({
            text: ch.title,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          })
        );

        for (const pg of ch.pages) {
          docParagraphs.push(
            new Paragraph({
              text: pg.title,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 150 },
            })
          );
          const paragraphs = pg.content.split('\n\n');
          for (const p of paragraphs) {
            if (p.trim()) {
              docParagraphs.push(
                new Paragraph({
                  children: [new TextRun(p.trim())],
                  spacing: { line: 360, after: 180 },
                })
              );
            }
          }
        }
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docParagraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, filename.endsWith('.docx') ? filename : `${filename}.docx`);
}

export function compileToMarkdown(book: Book, target: 'page' | 'chapter' | 'book', page?: Page, chapter?: Chapter): string {
  if (target === 'page' && page) {
    return `# ${page.title}\n\n${page.content}`;
  }

  if (target === 'chapter' && chapter) {
    let md = `# ${chapter.title}\n\n`;
    if (chapter.synopsis) md += `*${chapter.synopsis}*\n\n---\n\n`;
    for (const pg of chapter.pages) {
      md += `## ${pg.title}\n\n${pg.content}\n\n`;
    }
    return md;
  }

  // Full book
  let md = `# ${book.title}\n`;
  if (book.subtitle) md += `### ${book.subtitle}\n`;
  if (book.description) md += `\n*${book.description}*\n\n---\n\n`;

  for (const vol of book.volumes) {
    md += `# ${vol.title}\n\n`;
    for (const ch of vol.chapters) {
      md += `## ${ch.title}\n\n`;
      if (ch.synopsis) md += `*${ch.synopsis}*\n\n`;
      for (const pg of ch.pages) {
        md += `### ${pg.title}\n\n${pg.content}\n\n`;
      }
      md += `\n---\n\n`;
    }
  }

  return md;
}

export function triggerPrintPdf() {
  window.print();
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

export async function exportEpub(
  filename: string,
  book: Book,
  target: 'page' | 'chapter' | 'book',
  page?: Page,
  chapter?: Chapter
) {
  const zip = new JSZip();

  // 1. mimetype (Must be first, uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.file('META-INF/container.xml', containerXml);

  // Collect sections
  interface EpubSection {
    id: string;
    title: string;
    html: string;
  }
  const sections: EpubSection[] = [];

  const styleCss = `@charset "utf-8";
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Amiri", "Noto Naskh Arabic", "Times New Roman", serif;
  line-height: 1.8;
  margin: 5%;
  color: #1a1a1a;
  background-color: #ffffff;
}
h1 { font-size: 1.8em; margin-bottom: 0.8em; text-align: center; color: #2c2523; }
h2 { font-size: 1.4em; margin-top: 1.4em; margin-bottom: 0.6em; text-align: center; color: #4a3b32; }
h3 { font-size: 1.2em; margin-top: 1.2em; margin-bottom: 0.4em; color: #5a4b42; }
p { margin-bottom: 1em; text-indent: 1.2em; text-align: justify; }
.arabic { direction: rtl; text-align: right; font-family: "Amiri", "Noto Naskh Arabic", serif; }
.english { direction: ltr; text-align: left; }
.synopsis { font-style: italic; color: #666; margin: 1.5em 0; text-align: center; }
.cover-title { font-size: 2.2em; text-align: center; margin-top: 20%; margin-bottom: 0.2em; }
.cover-subtitle { font-size: 1.3em; text-align: center; font-style: italic; color: #666; margin-bottom: 1em; }
.cover-desc { font-size: 1em; text-align: center; color: #444; max-width: 80%; margin: 2em auto; }
hr { border: 0; height: 1px; background: #ddd; margin: 2em auto; width: 40%; }
`;
  zip.file('OEBPS/style.css', styleCss);

  // Cover / Title Page
  const coverHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(book.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body class="${isArabic(book.title) ? 'arabic' : 'english'}">
  <h1 class="cover-title">${escapeXml(book.title)}</h1>
  ${book.subtitle ? `<h2 class="cover-subtitle">${escapeXml(book.subtitle)}</h2>` : ''}
  <hr />
  ${book.description ? `<p class="cover-desc">${escapeXml(book.description)}</p>` : ''}
</body>
</html>`;
  sections.push({ id: 'cover', title: book.title, html: coverHtml });

  const renderParagraphs = (content: string) => {
    return (content || '')
      .split('\n\n')
      .filter((p) => p.trim())
      .map((p) => {
        const text = p.trim();
        const dirClass = isArabic(text) ? 'arabic' : 'english';
        return `<p class="${dirClass}">${escapeXml(text)}</p>`;
      })
      .join('\n');
  };

  if (target === 'page' && page) {
    const pageHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(page.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body class="${isArabic(page.title) ? 'arabic' : 'english'}">
  <h2>${escapeXml(page.title)}</h2>
  ${renderParagraphs(page.content)}
</body>
</html>`;
    sections.push({ id: 'section_page', title: page.title, html: pageHtml });
  } else if (target === 'chapter' && chapter) {
    let chapContent = `<h2>${escapeXml(chapter.title)}</h2>\n`;
    if (chapter.synopsis) {
      chapContent += `<p class="synopsis">${escapeXml(chapter.synopsis)}</p>\n<hr />\n`;
    }
    for (const pg of chapter.pages) {
      chapContent += `<h3>${escapeXml(pg.title)}</h3>\n`;
      chapContent += renderParagraphs(pg.content);
    }
    const chapHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body class="${isArabic(chapter.title) ? 'arabic' : 'english'}">
  ${chapContent}
</body>
</html>`;
    sections.push({ id: 'section_chapter', title: chapter.title, html: chapHtml });
  } else {
    // Full book
    let count = 1;
    for (const vol of book.volumes) {
      for (const ch of vol.chapters) {
        let chContent = `<h1>${escapeXml(vol.title)}</h1>\n`;
        chContent += `<h2>${escapeXml(ch.title)}</h2>\n`;
        if (ch.synopsis) {
          chContent += `<p class="synopsis">${escapeXml(ch.synopsis)}</p>\n<hr />\n`;
        }
        for (const pg of ch.pages) {
          chContent += `<h3>${escapeXml(pg.title)}</h3>\n`;
          chContent += renderParagraphs(pg.content);
        }
        const fileHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(ch.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body class="${isArabic(ch.title) ? 'arabic' : 'english'}">
  ${chContent}
</body>
</html>`;
        sections.push({
          id: `section_${count}`,
          title: ch.title,
          html: fileHtml,
        });
        count++;
      }
    }
  }

  // Save all section HTML files
  for (const s of sections) {
    zip.file(`OEBPS/${s.id}.xhtml`, s.html);
  }

  // Build nav.xhtml (HTML5 Navigation)
  const navHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
      ${sections.map((s) => `<li><a href="${s.id}.xhtml">${escapeXml(s.title)}</a></li>`).join('\n      ')}
    </ol>
  </nav>
</body>
</html>`;
  zip.file('OEBPS/nav.xhtml', navHtml);

  // Build toc.ncx (for older EPUB2 e-readers)
  const ncxXml = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${book.id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(book.title)}</text>
  </docTitle>
  <navMap>
    ${sections
      .map(
        (s, i) => `
    <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(s.title)}</text></navLabel>
      <content src="${s.id}.xhtml"/>
    </navPoint>`
      )
      .join('')}
  </navMap>
</ncx>`;
  zip.file('OEBPS/toc.ncx', ncxXml);

  // Build content.opf (Package Document)
  const nowIso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const opfXml = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${book.id}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:language>${book.primaryLanguage === 'ar' ? 'ar' : book.primaryLanguage === 'en' ? 'en' : 'und'}</dc:language>
    <meta property="dcterms:modified">${nowIso}</meta>
    ${book.description ? `<dc:description>${escapeXml(book.description)}</dc:description>` : ''}
  </metadata>
  <manifest>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${sections.map((s) => `<item id="${s.id}" href="${s.id}.xhtml" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${sections.map((s) => `<itemref idref="${s.id}"/>`).join('\n    ')}
  </spine>
</package>`;
  zip.file('OEBPS/content.opf', opfXml);

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
  downloadBlob(blob, filename.endsWith('.epub') ? filename : `${filename}.epub`);
}
