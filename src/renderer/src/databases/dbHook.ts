import { webTracer } from '@renderer/services/WebTraceService'
import { EntityTable } from 'dexie'

import db from '.'

const addHooks = (table: EntityTable<{ id: string } & { [key: string]: any }, 'id'>) => {
  table.hook('creating', (obj, primKey) => {
    webTracer.startActiveSpan(
      'create',
      {
        attributes: {
          'db.table': table.name,
          'db.id': primKey.id,
          inputs: JSON.stringify(obj),
          tags: 'database',
          outputs: primKey.id
        }
      },
      (span) => {
        span.end()
      }
    )
  })

  table.hook('updating', (modifications, primKey, obj) => {
    webTracer.startActiveSpan(
      'update',
      {
        attributes: {
          'db.table': table.name,
          'db.id': primKey,
          inputs: JSON.stringify(obj),
          tags: 'database',
          outputs: JSON.stringify(modifications)
        }
      },
      (span) => {
        span.end()
      }
    )
    return modifications
  })

  table.hook('deleting', (primKey, obj) => {
    webTracer.startActiveSpan(
      'update',
      {
        attributes: {
          'db.table': table.name,
          'db.id': primKey,
          inputs: primKey,
          tags: 'database',
          outputs: JSON.stringify(obj)
        }
      },
      (span) => {
        span.end()
      }
    )
    return undefined
  })

  table.hook('reading', (obj) => {
    webTracer.startActiveSpan(
      'update',
      {
        attributes: {
          'db.table': table.name,
          'db.id': obj.id,
          inputs: JSON.stringify(obj.id),
          tags: 'database',
          outputs: JSON.stringify(obj)
        }
      },
      (span) => {
        span.end()
      }
    )
    return obj
  })
}

addHooks(db.files)
addHooks(db.knowledge_notes)
addHooks(db.translate_history)
addHooks(db.message_blocks)
