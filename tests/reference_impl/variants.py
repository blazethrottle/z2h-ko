"""정답 구현(micrograd_ref.py)의 글자를 바꿔 일부러 틀린 구현을 만든다 (테스트 전용).

각 변형은 (바꿀 글자, 새 글자, 정답 파일에 나와야 하는 횟수) 목록이다. 횟수가 다르면 정답 파일이
바뀐 것이므로 테스트가 바로 멈춘다(변형이 소리 없이 무효가 되는 것을 막음).
"""
import pathlib
import types

SOURCE = pathlib.Path(__file__).with_name("micrograd_ref.py").read_text(encoding="utf-8")

PATCHES = {
    # 기울기를 += 로 쌓지 않고 = 로 덮어씀 (L01-S12의 버그)
    "eq_accumulate": [
        ("self.grad += 1.0 * out.grad", "self.grad = 1.0 * out.grad", 1),
        ("other.grad += 1.0 * out.grad", "other.grad = 1.0 * out.grad", 1),
        ("self.grad += other.data * out.grad", "self.grad = other.data * out.grad", 1),
        ("other.grad += self.data * out.grad", "other.grad = self.data * out.grad", 1),
        ("self.grad += other * (self.data ** (other - 1)) * out.grad",
         "self.grad = other * (self.data ** (other - 1)) * out.grad", 1),
        ("self.grad += (1 - t**2) * out.grad", "self.grad = (1 - t**2) * out.grad", 1),
        ("self.grad += out.data * out.grad", "self.grad = out.data * out.grad", 1),
    ],
    # 곱셈 기울기의 부호가 반대
    "mul_sign_flip": [
        ("self.grad += other.data * out.grad", "self.grad += -other.data * out.grad", 1),
    ],
    # backward()에서 reversed 빠짐
    "no_reversed": [
        ("for node in reversed(topo):", "for node in topo:", 1),
    ],
    # backward()에서 self.grad = 1.0 빠짐
    "no_grad_one": [
        ("        self.grad = 1.0\n", "        pass  # self.grad = 1.0 빠짐\n", 1),
    ],
    # tanh 기울기를 1 - t 로 틀리게 씀
    "tanh_grad_wrong": [
        ("self.grad += (1 - t**2) * out.grad", "self.grad += (1 - t) * out.grad", 1),
    ],
    # Neuron.parameters()에서 b 빠짐
    "params_missing_bias": [
        ("return self.w + [self.b]", "return self.w", 1),
    ],
    # 학습 갱신 부호가 반대 (L01-Q08의 버그)
    "update_sign_flip": [
        ("p.data += -lr * p.grad", "p.data += lr * p.grad", 1),
    ],
    # 위상 정렬에서 visited 확인 빠짐 (같은 값이 여러 번 줄 섬)
    "no_visited": [
        ("if v not in visited:", "if True:", 2),
    ],
}


def load(name=None):
    """변형 이름을 받아 모듈 하나를 돌려준다. None이면 정답 그대로."""
    src = SOURCE
    for old, new, count in PATCHES.get(name, []) if name else []:
        found = src.count(old)
        assert found == count, f"변형 {name}: {old!r} 가 {found}번 나옴(기대 {count}번)"
        src = src.replace(old, new)
    mod = types.ModuleType(f"micrograd_variant_{name or 'ok'}")
    exec(compile(src, f"<micrograd 변형 {name or 'ok'}>", "exec"), mod.__dict__)
    return mod
