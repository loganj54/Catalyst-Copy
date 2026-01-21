import React, { useState } from 'react';
import { Image, X, ExternalLink, Info } from 'lucide-react';

/**
 * FigureDisplay Component
 * 
 * Renders figures, diagrams, charts, and tables with attribution.
 * Shows figure name, image, description, and source information.
 * Includes lightbox for full-size viewing.
 * 
 * @param {Object} props
 * @param {Array} props.figures - Array of figure objects
 * @param {string} props.figures[].name - Name of the figure
 * @param {string} props.figures[].description - Description of what the figure shows
 * @param {string} props.figures[].figure_type - Type: diagram, chart, graph, table, illustration
 * @param {string} props.figures[].file_url - URL to the full-size image
 * @param {string} props.figures[].thumbnail_url - URL to thumbnail (optional)
 * @param {string} props.figures[].source - Source of the figure (e.g., "Wikimedia Commons")
 * @param {string} props.figures[].license - License type (e.g., "CC-BY-SA")
 * @param {string} props.figures[].original_url - Link to original source for attribution
 * @param {string} props.figures[].relevance_explanation - Why this figure helps (optional)
 */
const FigureDisplay = ({ figures }) => {
  const [lightboxImage, setLightboxImage] = useState(null);

  if (!figures || figures.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wide">
          <Image className="w-4 h-4 text-blue-500" />
          Reference Figures
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {figures.map((figure, idx) => (
            <FigureCard
              key={figure.id || idx}
              figure={figure}
              index={idx + 1}
              onImageClick={() => setLightboxImage(figure)}
            />
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <Lightbox
          figure={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </>
  );
};

/**
 * Individual Figure Card
 */
const FigureCard = ({ figure, index, onImageClick }) => {
  const {
    name,
    description,
    figure_type,
    file_url,
    thumbnail_url,
    source,
    license,
    original_url,
    relevance_explanation,
    from_cache
  } = figure;

  const displayUrl = thumbnail_url || file_url;

  // Get type badge color
  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'diagram': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'chart': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'graph': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      case 'table': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
      case 'illustration': return 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300';
      default: return 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300';
    }
  };

  return (
    <div className="bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden h-full flex flex-col">
      {/* Figure Header */}
      <div className="px-4 py-3 bg-stone-100/50 dark:bg-stone-900/50 border-b border-stone-200 dark:border-stone-700">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex items-center justify-center w-6 h-6 bg-stone-500 text-white text-xs font-bold rounded-full shrink-0">
              {index}
            </span>
            <h4 className="font-normal tracking-tight text-stone-900 dark:text-stone-100 truncate">{name || 'Figure'}</h4>
          </div>
          {from_cache && (
            <span className="shrink-0 text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800">
              Verified
            </span>
          )}
        </div>
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${getTypeBadgeColor(figure_type)}`}>
          {figure_type}
        </span>
      </div>

      {/* Figure Image */}
      <div
        className="px-4 py-4 bg-white dark:bg-stone-900 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
        onClick={onImageClick}
      >
        <div className="flex justify-center items-center min-h-[200px] max-h-[250px] overflow-hidden rounded-lg border border-stone-200 dark:border-stone-700">
          <img
            src={displayUrl}
            alt={name}
            className="max-w-full max-h-[250px] object-contain"
            loading="lazy"
            onError={(e) => {
              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3EImage not available%3C/text%3E%3C/svg%3E';
            }}
          />
        </div>
        <p className="text-xs text-center text-stone-500 dark:text-stone-400 mt-2 hover:underline">
          Click to view full size
        </p>
      </div>

      {/* Description */}
      {(description || relevance_explanation) && (
        <div className="px-4 py-3 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-200 dark:border-stone-700">
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
            {relevance_explanation || description}
          </p>
        </div>
      )}

      {/* Attribution */}
      {source && (
        <div className="px-4 py-3 bg-stone-100 dark:bg-stone-900 border-t border-stone-200 dark:border-stone-700 mt-auto">
          <div className="flex items-start gap-2">
            <Info className="w-3 h-3 text-stone-500 dark:text-stone-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Source: {source}
                {license && ` (${license})`}
              </p>
              {original_url && (
                <a
                  href={original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1"
                >
                  View original
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Lightbox Modal for Full-Size Image Viewing
 */
const Lightbox = ({ figure, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white dark:bg-stone-800 rounded-full hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
      >
        <X className="w-6 h-6 text-stone-700 dark:text-stone-300" />
      </button>

      <div
        className="max-w-6xl max-h-[90vh] bg-white dark:bg-stone-900 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-stone-200 dark:border-stone-700">
          <h3 className="text-lg font-normal tracking-tight text-stone-900 dark:text-stone-100">
            {figure.name}
          </h3>
          {figure.description && (
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
              {figure.description}
            </p>
          )}
        </div>

        <div className="p-4 flex items-center justify-center max-h-[70vh] overflow-auto">
          <img
            src={figure.file_url}
            alt={figure.name}
            className="max-w-full max-h-full object-contain"
          />
        </div>

        {figure.source && (
          <div className="p-4 border-t border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  Source: {figure.source} {figure.license && `(${figure.license})`}
                </p>
              </div>
              {figure.original_url && (
                <a
                  href={figure.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
                >
                  View Original
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FigureDisplay;

