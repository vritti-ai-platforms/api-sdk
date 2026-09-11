import type { Type } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA } from '@nestjs/common/constants';

// The operation ids Swagger derives for every route-decorated method of the given modules' controllers
// (`${ControllerName}_${method}`). A server's coverage test compares this with what its tools cover and exclude.
export function collectOperationIds(modules: Type[]): string[] {
  const ids: string[] = [];
  for (const module of modules) {
    const controllers: Type[] = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) ?? [];
    for (const controller of controllers) {
      const prototype = controller.prototype as Record<string, unknown>;
      for (const method of Object.getOwnPropertyNames(prototype)) {
        if (method === 'constructor') continue;
        const handler = prototype[method];
        if (typeof handler !== 'function') continue;
        if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
        ids.push(`${controller.name}_${method}`);
      }
    }
  }
  return ids;
}
