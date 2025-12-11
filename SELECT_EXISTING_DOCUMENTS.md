# Select Existing Documents Feature (Final UI)

## Overview
Added the ability to select existing class documents when creating a blueprint from within a class. The UI is integrated into a single unified container that prioritizes selecting existing documents while maintaining easy access to upload new ones.

## How It Works

### Unified Interface:
1. **Single Container**: The "Show me what you're looking at" section is a single rectangle.
2. **Smart View**: 
   - If the class has documents, it shows the **Select List** by default.
   - If no documents, it shows the **Upload Prompt** by default.
3. **Internal Action**: A "Upload New" button in the top-right corner (visible when list is shown) immediately opens the file explorer.
4. **Drag and Drop**: You can drag a file onto the container *at any time* (even when viewing the list) to upload a new file.

### Modes:

#### 1. Select Mode (Default if docs exist)
- Shows a vertical scrollable list of existing documents.
- Each item shows name, size, and date.
- Click an item to select it.

#### 2. Upload Mode (Default if no docs)
- Shows the standard "Click or drag file" prompt.
- Click anywhere to open file browser.

#### 3. File Ready Mode
- When a file is selected (from list or uploaded), the view changes to show the selected file.
- Shows file name, size, and type.
- "Existing Document" badge if selected from list.
- Trash icon to remove/change selection.

### Key Interactions:
- **Uploading**: Click "Upload New" button OR drag & drop a file OR click the upload placeholder (if empty).
- **Selecting**: Click any document in the list.
- **Removing**: Clicking the trash icon clears the selection and returns to the previous view (list or upload prompt).

### Technical Implementation:

#### State Management:
- `isDragging`: Tracks drag state for overlay.
- `selectedDocument` / `uploadedFile`: Tracks the chosen file.
- `existingDocuments`: Array of fetched documents.

#### Database Integration:
- Fetches documents from `class_documents` table when modal opens.
- Uses RLS policies to ensure security.

### Benefits:
- **Streamlined**: No mode switching required to upload.
- **Intuitive**: "Upload New" acts as an immediate action.
- **Efficient**: Prioritizes reuse of existing documents.
- **Flexible**: Drag and drop works everywhere.

## Testing Checklist:
- [ ] Open blueprint modal from class with documents.
- [ ] Verify list view is shown by default.
- [ ] Click "Upload New" -> File explorer opens immediately.
- [ ] Drag a file over the list -> Drop to upload.
- [ ] Select document from list -> Verify selection.
- [ ] Remove selection -> Return to list.
- [ ] Open modal from class with NO documents -> Verify upload placeholder.
