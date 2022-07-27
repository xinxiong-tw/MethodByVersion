import 'reflect-metadata';
import compareVersions from "compare-versions";

class Foo {
    @MethodByVersion("hello", "8.15.0", ">")
    private helloV2(name: string) {
        return "hello" + name;
    }

    @MethodByVersion("hello", "8.15.0", "<=")
    private helloV1() {
        return "hi";
    }

    @Method
    hello(version: string, name?: string): string {
        return '';
    }
}
class MethodCaller {
    static call(object: object, name: string, version: string, args: any[]) {
        const prototype = Reflect.getPrototypeOf(object);
        if (!prototype) {
            return;
        }
        const methodsMap = Reflect.getMetadata('methodsMap', prototype);
        const methods: MethodWithVersion[] = methodsMap.get(name);
        const targetMethod = methods.find(it => compareVersions.compare(version, it.version, it.comparator))?.method;
        if (targetMethod) {
            return targetMethod.call(object, args);
        }

        const ownKeys = Reflect.ownKeys(prototype) as string[];
        const methodName = ownKeys.find(key => key === name);
        if (!methodName) {
            return;
        }
        const method = Reflect.get(prototype, methodName, object);
        return Reflect.apply(method, object, args);
    }
}
const foo = new Foo();
console.log(foo.hello('9.0.0', 'world'));
console.log(foo.hello('8.1.0', 'world'));

type Comparator = '>' | '<' | '=' | '>=' | '<=';

type MethodWithVersion = { version: string, comparator: Comparator, method: Function };

function MethodByVersion(name: string, version: string, comparator: Comparator) {
    return (target: object, key: string, descriptor: PropertyDescriptor) => {
        const methodsMap: Map<string, MethodWithVersion[]> = Reflect.getMetadata('methodsMap', target) ?? new Map();
        const methods = methodsMap.get(name) ?? [];
        methods.push({
            version,
            comparator,
            method: descriptor.value,
        });
        methodsMap.set(name, methods);
        Reflect.defineMetadata('methodsMap', methodsMap, target);
    }
}

function Method(target: object, key: string, descriptor: PropertyDescriptor) {
    descriptor.value = function (version: string, ...args: any[]) {
        return MethodCaller.call(this, key, version, args);
    }
}
