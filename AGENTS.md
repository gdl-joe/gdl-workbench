# GDL-UI-Studio - Project Context

## Project Overview
**GDL-UI-Studio** is a web-based parameter management system for Graphisoft Archicad GDL development. It provides a complete solution for managing GDL projects, objects, and their parameters with a modern, user-friendly interface.

## Technology Stack
- **Backend**: PHP 8.x with Slim Framework 4
- **Database**: MySQL/MariaDB
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Server**: MAMP (localhost:8888)
- **API**: RESTful API with JSON responses

## Project Structure
```
gdl-ui-studio/
├── backend/
│   ├── public/
│   │   └── index.php          # Entry point
│   └── src/
│       ├── Controllers/
│       │   ├── ProjectController.php        # Project CRUD + duplicate
│       │   ├── GdlObjectController.php      # Object CRUD + duplicate
│       │   └── ParameterController.php      # Parameter management + XML import/export
│       └── routes.php                       # API routes definition
├── public/
│   ├── dashboard.html                       # NEW: Project management dashboard
│   ├── object-selection.html                # NEW: Object selection page
│   └── param-management.html                # Parameter management interface
├── database/
│   ├── install_UPDATED.sql                  # Main database schema
│   └── migrations/
│       └── 001_add_project_management_fields.sql
└── xml/
    └── export.xml                           # XML import/export format

```

## Database Schema (3-Level Hierarchy)

### 1. Projects Table
```sql
- id (PK)
- name
- description (NEW)
- status (NEW: active, archive, wip, urgent)
- folder_path (NEW: link to filesystem)
- created_at
- updated_at
- last_modified_at (NEW)
```

### 2. GDL Objects Table
```sql
- id (PK)
- project_id (FK -> projects)
- name
- description (NEW)
- status (NEW: active, archive, wip, urgent)
- file_path (NEW: link to .gsm file)
- created_at
- updated_at
- last_modified_at (NEW)
```

### 3. Parameters Table
```sql
- id (PK)
- gdl_object_id (FK -> gdl_objects)
- gdl_name
- gdl_type
- type_color (NEW: color coding for parameter types)
- function_group
- array_type
- array_first_dim
- array_second_dim
- default_value_json
- is_fix_name
- flag_bold, flag_child, flag_hidden, flag_unique
- ui_page
- is_ui_element
- ui_code
- sort_order (for positioning)
- created_at
- updated_at
```

### 4. Parameter Translations Table
```sql
- id (PK)
- param_id (FK -> parameters)
- language_code (de, en, hu)
- description
- values_list
- ui_tooltip
- created_at
- updated_at
```

### 5. Parameter Type Colors Table (NEW)
```sql
- id (PK)
- gdl_type (UNIQUE)
- color (hex color code)
- created_at
- updated_at
```

## Key Features Implemented (December 10, 2024)

### ✅ Project Management Dashboard
- Beautiful card-based interface
- Status indicators (active, archive, wip, urgent)
- Search and filter functionality
- CRUD operations (Create, Read, Update, Delete)
- **Duplicate projects** with all objects and parameters
- Folder path linking to filesystem
- Statistics overview
- Responsive design with hover effects

### ✅ Object Selection Page
- Similar card-based interface as projects
- Status management
- File path linking (.gsm files)
- Parameter count display
- **Duplicate objects** with all parameters
- Breadcrumb navigation

### ✅ Parameter Management
- **Auto-save**: All changes directly saved to database (no save button needed)
- **Insert at position**: Add parameters at any location, not just at end
- **Type color coding**: Visual distinction by parameter type
- Inline editing in table cells
- Drag & drop reordering
- Multi-language support (DE/EN/HU)
- Checkbox flags (bold, unique, fix_name, etc.)
- XML import/export
- Bulk operations

### ✅ Navigation Flow
1. **Dashboard** (dashboard.html) - Project selection
2. **Object Selection** (object-selection.html) - Choose GDL object
3. **Parameter Management** (param-management.html) - Edit parameters
4. **UI Designer** (future feature)

## API Endpoints

### Projects
```
GET    /api/projects                      # Get all projects
POST   /api/projects                      # Create new project
GET    /api/projects/{id}                 # Get single project
PUT    /api/projects/{id}                 # Update project
DELETE /api/projects/{id}                 # Delete project
POST   /api/projects/{id}/duplicate       # Duplicate project
```

### GDL Objects
```
GET    /api/projects/{id}/objects         # Get objects by project
POST   /api/gdl-objects                   # Create new object
GET    /api/gdl-objects/{id}              # Get single object
PUT    /api/gdl-objects/{id}              # Update object
DELETE /api/gdl-objects/{id}              # Delete object
POST   /api/gdl-objects/{id}/duplicate    # Duplicate object
```

### Parameters
```
GET    /api/objects/{id}/parameters       # Get parameters by object
POST   /api/parameters/create             # Create parameter (at end)
POST   /api/parameters/insert             # Insert at specific position
PUT    /api/parameters/{id}               # Update parameter
DELETE /api/parameters/{id}               # Delete parameter
POST   /api/parameters/reorder            # Reorder (drag & drop)
POST   /api/parameters/bulk-delete        # Delete multiple
POST   /api/parameters/import             # Import from XML
GET    /api/objects/{id}/parameters/export # Export to XML
```

### Parameter Type Colors
```
GET    /api/parameter-type-colors         # Get all type colors
PUT    /api/parameter-type-colors/{type}  # Update type color
```

## Default Parameter Type Colors
```javascript
{
  "STRING": "#3498db",    // Blue
  "INTEGER": "#2ecc71",   // Green
  "LENGTH": "#e74c3c",    // Red
  "ANGLE": "#f39c12",     // Orange
  "BOOLEAN": "#9b59b6",   // Purple
  "MATERIAL": "#1abc9c",  // Turquoise
  "FILL": "#e67e22",      // Dark Orange
  "PEN": "#34495e",       // Dark Gray
  "STYLE": "#16a085",     // Teal
  "REAL": "#27ae60"       // Dark Green
}
```

## Recent Changes (December 10, 2024)

### Database Migration
- Added `description`, `status`, `folder_path`, `last_modified_at` to projects
- Added `status`, `file_path`, `last_modified_at` to gdl_objects
- Added `type_color` to parameters
- Created `parameter_type_colors` table with default colors

### New Controllers Methods
- `ProjectController::duplicateProject()` - Deep copy with all relations
- `GdlObjectController::duplicateObject()` - Copy object with parameters
- `ParameterController::insertParameter()` - Insert at specific position
- `ParameterController::getTypeColors()` - Retrieve type color mapping
- `ParameterController::updateTypeColor()` - Update type colors

### New Frontend Pages
- `dashboard.html` - Modern project management interface
- `object-selection.html` - Object selection with statistics

### Updated API Responses
All endpoints now return consistent format:
```json
{
  "success": true|false,
  "data": {...},
  "error": "error message if failed"
}
```

## Future Enhancements (Planned)

### High Priority
1. ✅ Auto-save functionality
2. ✅ Insert parameter at any position
3. ✅ Project duplication
4. ✅ Object duplication
5. ✅ Status management
6. ✅ Folder/file path linking
7. ✅ Type color coding

### Medium Priority
- UI Designer integration
- Filesystem sync (auto-detect GDL projects)
- Parameter validation rules
- Export to GDL script
- Version history
- User authentication
- Collaborative editing

### Low Priority
- Dark mode
- Keyboard shortcuts
- Advanced search
- Parameter templates
- Batch import from multiple files

## Development Notes

### LocalStorage Usage
- `currentProjectId` - Selected project ID
- `currentGdlObjectId` - Selected GDL object ID

### CORS Configuration
CORS is enabled for local development in `backend/public/index.php`

### Auto-save Implementation
Parameters are saved automatically on:
- Cell blur (inline editing)
- Checkbox change
- Drag & drop reorder
- Type selection change

### Insert at Position
When inserting a parameter at position N:
1. All parameters with `sort_order >= N` are incremented by 1
2. New parameter is inserted with `sort_order = N`
3. This maintains correct ordering

## Testing URLs
- Dashboard: http://localhost:8888/gdl-ui-studio/public/dashboard.html
- Object Selection: http://localhost:8888/gdl-ui-studio/public/object-selection.html
- Parameter Management: http://localhost:8888/gdl-ui-studio/public/param-management.html
- API Test: http://localhost:8888/gdl-ui-studio/backend/public/api/projects

## Known Issues
None currently - all features working as expected.

## Performance Notes
- Database queries are optimized with proper indexes
- Foreign key constraints ensure data integrity
- Cascading deletes handle cleanup automatically
- Transaction support for complex operations (duplicate, import)

## Last Updated
December 10, 2024 - Major feature additions complete
