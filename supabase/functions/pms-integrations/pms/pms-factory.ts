import { PMSInterface } from './pms-interface.ts'
import { CareStackAdapter } from '../../_shared/carestack-adapter.ts'
import { DentrixAdapter } from './dentrix-adapter.ts'
import { EaglesoftAdapter } from './eaglesoft-adapter.ts'
import { DummyAdapter } from './dummy-adapter.ts'

export class PMSFactory {
  static createAdapter(pmsType: string, credentials: any): PMSInterface {
    switch (pmsType.toLowerCase()) {
      case 'carestack':
        return new CareStackAdapter(credentials)
      case 'dentrix':
        return new DentrixAdapter(credentials)
      case 'eaglesoft':
        return new EaglesoftAdapter(credentials)
      case 'dummy':
        return new DummyAdapter(credentials)
      default:
        throw new Error(`Unsupported PMS type: ${pmsType}`)
    }
  }
}