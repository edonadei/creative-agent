"use client";

import Image from 'next/image';
import type { GalleryImage } from '~/types/conversation';

interface ImageGalleryProps {
  images: GalleryImage[];
  onAddImage?: (image: GalleryImage) => void;
  onRemoveImage: (imageId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function ImageGallery({
  images,
  onAddImage: _onAddImage,
  onRemoveImage,
  isOpen,
  onToggle
}: ImageGalleryProps) {



  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Gallery Sidebar */}
      <div className={`
        fixed right-0 top-0 h-full bg-gradient-to-b from-purple-50 to-pink-50 border-l border-purple-200 z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        lg:relative lg:translate-x-0 lg:z-auto
        w-96 lg:w-[28rem]
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 text-center bg-gradient-to-r from-purple-100 to-pink-100 relative group">
            <div className="flex items-center justify-center space-x-2">
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Creative Gallery
              </h2>
              <div className="relative">
                <svg className="w-4 h-4 text-purple-400 opacity-60 hover:opacity-100 transition-opacity cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  Images here guide Awen&apos;s future generations
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                </div>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="absolute top-4 right-4 lg:hidden p-2 rounded-full hover:bg-purple-200 transition-colors"
            >
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Images Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-3 gap-4">
              {images.map((image: GalleryImage, index: number) => (
                <div
                  key={image.id}
                  className="group relative bg-white rounded-xl shadow-sm hover:shadow-2xl transition-all duration-500 transform hover:scale-110 hover:-rotate-1 animate-fadeInUp overflow-hidden border border-purple-100 hover:border-purple-300"
                  style={{
                    animationDelay: `${index * 100}ms`
                  }}
                >
                  {/* Image */}
                  <div className="aspect-square bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center overflow-hidden relative">
                    {image.content.startsWith('http') ? (
                      <>
                        <Image 
                          src={image.content} 
                          alt={image.title}
                          fill
                          className="object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                        {/* Hover overlay with controls */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
                            <button
                              onClick={() => onRemoveImage(image.id)}
                              className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-xl hover:bg-red-50 hover:scale-110 transition-all duration-300 border border-white/20"
                              title="Remove"
                            >
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : image.content.includes('**Image Prompt:**') ? (
                      <>
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-3 bg-gradient-to-br from-purple-50 to-blue-50">
                          <svg className="w-8 h-8 mb-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          <p className="text-xs font-semibold text-purple-700 mb-1">AI Image Prompt</p>
                          <p className="text-xs text-purple-600 line-clamp-4 leading-tight">
                            {image.content.split('\n').slice(1, 3).join(' ').replace(/\*\*/g, '')}
                          </p>
                        </div>
                        {/* Hover overlay with controls */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
                            <button
                              onClick={() => onRemoveImage(image.id)}
                              className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-xl hover:bg-red-50 hover:scale-110 transition-all duration-300 border border-white/20"
                              title="Remove"
                            >
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-center p-4">
                        <div>
                          <svg className="w-8 h-8 mx-auto mb-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm font-medium text-purple-700">{image.content}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}