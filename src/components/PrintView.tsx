import React from 'react';
import { Book } from '../types';

interface PrintViewProps {
  book: Book;
}

export const PrintView: React.FC<PrintViewProps> = ({ book }) => {
  return (
    <div className="print-only print-book-content">
      {/* Title Page */}
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-12 print-page-break">
        <h1 className="text-4xl font-bold mb-4 font-amiri">{book.title}</h1>
        {book.subtitle && <h2 className="text-xl text-stone-600 mb-8 font-lora italic">{book.subtitle}</h2>}
        {book.genre && <p className="text-sm uppercase tracking-widest text-stone-500 mb-12">{book.genre}</p>}
        {book.description && (
          <div className="max-w-md mx-auto text-sm text-stone-600 leading-relaxed italic border-t border-b border-stone-200 py-6 my-8">
            {book.description}
          </div>
        )}
      </div>

      {/* Chapters & Content */}
      {book.volumes.map((volume, volIndex) => (
        <div key={volume.id}>
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-12 print-page-break">
            <h2 className="text-2xl font-bold font-amiri">{volume.title}</h2>
          </div>

          {volume.chapters.map((chapter) => (
            <div key={chapter.id} className="p-8 print-page-break">
              <h3 className="text-xl font-bold mb-6 pb-2 border-b border-stone-300 font-amiri">
                {chapter.title}
              </h3>
              {chapter.synopsis && (
                <p className="text-sm italic text-stone-500 mb-6">{chapter.synopsis}</p>
              )}

              {chapter.pages.map((page) => (
                <div key={page.id} className="mb-8">
                  {chapter.pages.length > 1 && (
                    <h4 className="text-base font-semibold mb-4 text-stone-700">{page.title}</h4>
                  )}
                  <div className="text-base leading-loose whitespace-pre-wrap font-amiri text-justify">
                    {page.content}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
