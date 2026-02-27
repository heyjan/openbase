declare module 'h3' {
  interface H3EventContext {
    admin?: import('~~/server/utils/admin-store').AdminUser
    editor?: import('~~/server/utils/editor-store').EditorUser
  }
}

export {}
